"""PaperDigest API (Flask): arXiv computational feed proxy + Gemini AI reader.

This repository is the backend only. The static frontend is a separate repo and
calls this API cross-origin via its configured API base URL.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request

from . import ai, arxiv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

app = Flask(__name__, static_folder=None)


class APIError(Exception):
    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.message = message
        self.status = status


@app.errorhandler(APIError)
def handle_api_error(error: APIError):
    return jsonify({"detail": error.message}), error.status


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return "", 204


def configured_origins() -> list[str] | None:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or None


@app.after_request
def add_cors_headers(response):
    origins = configured_origins()
    origin = request.headers.get("Origin", "")
    if origins is None:
        response.headers["Access-Control-Allow-Origin"] = "*"
    elif origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def paper_from_body(data: dict):
    paper = data.get("paper")
    if not isinstance(paper, dict):
        paper = None
    context = data.get("paper_context", "")
    if not isinstance(context, str):
        context = ""
    return paper, context


def answer(prompt: str) -> str:
    try:
        return ai.generate(prompt)
    except ai.AIServiceError as exc:
        if "not configured" in str(exc).lower():
            raise APIError(
                "AI is not configured. Add GEMINI_API_KEY to your .env file.", 503
            ) from exc
        raise APIError(f"AI request failed: {exc}", 502) from exc


def api_info():
    return jsonify(
        {
            "message": "Welcome to PaperDigest API!",
            "status": "running",
            "paper_source": "arXiv computational research",
            "frontend": "https://github.com/sonalibansal985-bit/Paper-Digest-Frontend",
        }
    )


@app.get("/")
@app.get("/api")
def home():
    return api_info()


@app.get("/health")
def health_check():
    return jsonify({"status": "healthy"})


@app.get("/api/test")
def test_connection():
    return jsonify(
        {
            "message": "Frontend and backend are ready to connect!",
            "success": True,
            "ai_configured": bool(os.getenv("GEMINI_API_KEY")),
        }
    )


@app.get("/api/papers")
def get_papers():
    refresh = request.args.get("refresh", "").lower() in ("1", "true", "yes")
    try:
        count = int(request.args.get("count", arxiv.DEFAULT_COUNT))
    except (TypeError, ValueError):
        count = arxiv.DEFAULT_COUNT
    count = max(1, min(count, arxiv.POOL_SIZE))
    seed = request.args.get("seed") or None

    try:
        papers = arxiv.fetch_papers(count=count, seed=seed, force=refresh)
    except Exception as exc:
        raise APIError(f"Could not load papers from arXiv: {exc}", 502) from exc

    return jsonify(
        {
            "papers": papers,
            "source": arxiv.SOURCE_URL,
            "categories": list(arxiv.COMPUTATIONAL_CATEGORIES),
            "count": len(papers),
        }
    )


@app.post("/api/summarize")
def summarize():
    paper, context = paper_from_body(body())
    return jsonify({"summary": answer(ai.build_summary_prompt(paper, context))})


@app.post("/api/questions")
def questions():
    paper, context = paper_from_body(body())
    text = answer(ai.build_questions_prompt(paper, context))
    return jsonify({"questions": ai.parse_lines(text, limit=4)})


@app.post("/api/notes")
def notes():
    paper, context = paper_from_body(body())
    text = answer(ai.build_notes_prompt(paper, context))
    return jsonify({"notes": ai.parse_lines(text, limit=4)})


@app.post("/api/ask")
def ask():
    data = body()
    question = data.get("question", "")
    if not isinstance(question, str) or not question.strip():
        raise APIError("Question cannot be empty", 400)
    paper, context = paper_from_body(data)
    return jsonify({"answer": answer(ai.build_ask_prompt(paper, question, context))})
