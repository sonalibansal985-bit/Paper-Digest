"""PaperDigest API: arXiv q-fin.CP feed proxy and Gemini-backed AI reader."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import ai, arxiv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

app = FastAPI(
    title="PaperDigest API",
    description="Backend for PaperDigest: arXiv feed proxy + AI paper reader",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PaperRequest(BaseModel):
    paper: dict[str, Any] | None = None
    paper_context: str = ""


class AskRequest(PaperRequest):
    question: str


@app.get("/")
def home():
    return {
        "message": "Welcome to PaperDigest API!",
        "status": "running",
        "paper_source": "arXiv computational research",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/test")
def test_connection():
    return {
        "message": "Frontend and backend are ready to connect!",
        "success": True,
        "ai_configured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.get("/api/papers")
def get_papers(refresh: bool = False, count: int = arxiv.DEFAULT_COUNT, seed: str | None = None):
    count = max(1, min(count, arxiv.POOL_SIZE))
    try:
        papers = arxiv.fetch_papers(count=count, seed=seed, force=refresh)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not load papers from arXiv: {exc}"
        ) from exc
    return {
        "papers": papers,
        "source": arxiv.SOURCE_URL,
        "categories": list(arxiv.COMPUTATIONAL_CATEGORIES),
        "count": len(papers),
    }


def _ai_error(exc: ai.AIServiceError) -> HTTPException:
    if "not configured" in str(exc).lower():
        return HTTPException(
            status_code=503,
            detail="AI is not configured. Add GEMINI_API_KEY to your .env file.",
        )
    return HTTPException(status_code=502, detail=f"AI request failed: {exc}")


def _answer(request: PaperRequest, prompt: str) -> str:
    try:
        return ai.generate(prompt)
    except ai.AIServiceError as exc:
        raise _ai_error(exc) from exc


@app.post("/api/summarize")
def summarize(request: PaperRequest):
    return {
        "summary": _answer(
            request, ai.build_summary_prompt(request.paper, request.paper_context)
        )
    }


@app.post("/api/questions")
def questions(request: PaperRequest):
    text = _answer(
        request, ai.build_questions_prompt(request.paper, request.paper_context)
    )
    return {"questions": ai.parse_lines(text, limit=4)}


@app.post("/api/notes")
def notes(request: PaperRequest):
    text = _answer(
        request, ai.build_notes_prompt(request.paper, request.paper_context)
    )
    return {"notes": ai.parse_lines(text, limit=4)}


@app.post("/api/ask")
def ask(request: AskRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    return {
        "answer": _answer(
            request,
            ai.build_ask_prompt(request.paper, question, request.paper_context),
        )
    }
