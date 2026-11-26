"""PaperDigest API (Flask): arXiv computational feed proxy + Gemini AI reader."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory

from . import ai, arxiv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

# The same Flask process serves both the API and the frontend, so a single
# deployment URL is all that is needed.
app = Flask(__name__, static_folder=None)

ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
]


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


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Vary"] = "Origin"
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


# ---------- frontend (single-site deployment) ----------


@app.get("/")
@app.get("/index.html")
def frontend_index():
    return send_from_directory(ROOT_DIR, "index.html")


@app.get("/reader.html")
def frontend_reader():
    return send_from_directory(ROOT_DIR, "reader.html")


@app.get("/<path:filepath>")
def frontend_asset(filepath: str):
    # Only browser assets are public; .env, backend code and tests are not.
    if not filepath.startswith("js/"):
        abort(404)
    return send_from_directory(ROOT_DIR, filepath)


# ---------- API ----------


@app.get("/api")
def home():
    return jsonify(
        {
            "message": "Welcome to PaperDigest API!",
            "status": "running",
            "paper_source": "arXiv computational research",
        }
    )


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
    return jsonify(
        {"answer": answer(ai.build_ask_prompt(paper, question, context))}
    )
