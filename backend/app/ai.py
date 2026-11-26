"""Prompt building and Gemini access for PaperDigest's AI reader.

Prompt helpers are pure functions so they can be tested without calling Gemini.
"""

from __future__ import annotations

import os
import re
from typing import Any

from google import genai

DEFAULT_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = ("gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-4-hydrogen")
MAX_CONTEXT_CHARS = 6000
MAX_QUESTION_CHARS = 600

class AIServiceError(Exception):
    """Raised when Gemini is unconfigured or fails."""


def get_model_candidates() -> list[str]:
    """Primary model from config, then fallbacks for temporary 503s."""
    primary = os.getenv("GEMINI_MODEL") or DEFAULT_MODEL
    return [primary] + [model for model in FALLBACK_MODELS if model != primary]


def get_client():
    # A fresh client per request: FastAPI runs sync endpoints in a thread pool,
    # and the SDK's HTTP client is bound to the thread/event loop that made it.
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise AIServiceError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=api_key)


def build_context(paper: Any | None, fallback: str = "") -> str:
    """Build a compact, grounded description of a paper for prompts."""
    if isinstance(paper, str):
        text = paper.strip()
        return (text or fallback or "No paper selected.")[:MAX_CONTEXT_CHARS]
    if not isinstance(paper, dict) or not paper:
        return (fallback or "No paper selected.")[:MAX_CONTEXT_CHARS]

    authors = paper.get("authors") or []
    if isinstance(authors, str):
        authors = [authors]
    categories = paper.get("categories") or []
    if isinstance(categories, str):
        categories = [categories]

    lines = [
        f"Title: {paper.get('title', '')}",
        f"Authors: {', '.join(str(a) for a in authors)}",
        f"Categories: {paper.get('primaryCategory', '')}, {', '.join(str(c) for c in categories)}",
        f"Published: {paper.get('published', '')}",
        f"Abstract: {paper.get('abstract', '')}",
    ]
    return "\n".join(line for line in lines if line.split(":", 1)[1].strip())[
        :MAX_CONTEXT_CHARS
    ]


def build_summary_prompt(paper: Any | None, fallback: str = "") -> str:
    return f"""You are PaperDigest's research reading assistant.

Summarise the research paper below for a student who is new to the topic.
Use plain English. Be accurate and do not invent details that are not in the paper.

Paper:
{build_context(paper, fallback)}

Write a short summary with exactly these four labelled sections, each 1-3 sentences:
Overview:
Key findings:
Method:
Limitations:
"""


def build_questions_prompt(paper: Any | None, fallback: str = "") -> str:
    return f"""You are PaperDigest's research reading assistant.

Based only on the paper below, write 4 questions a student could ask to understand it better.

Paper:
{build_context(paper, fallback)}

Return exactly 4 questions, one per line. Do not number them and do not use bullets.
"""


def build_ask_prompt(paper: Any | None, question: str, fallback: str = "") -> str:
    safe_question = question.strip()[:MAX_QUESTION_CHARS]
    return f"""You are PaperDigest's research reading assistant.

Answer the user's question using only the paper below. If the paper does not contain
the answer, say "The paper does not specify this." Do not invent details.

Paper:
{build_context(paper, fallback)}

Question:
{safe_question}
"""


def build_notes_prompt(paper: Any | None, fallback: str = "") -> str:
    return f"""You are PaperDigest's research reading assistant.

Turn the paper below into 4 short study notes. Each note should be one clear sentence
capturing a useful finding, method, or limitation.

Paper:
{build_context(paper, fallback)}

Return exactly 4 notes, one per line. Do not number them and do not use bullets.
"""


def parse_lines(text: str, limit: int) -> list[str]:
    """Parse a model response into a clean list of lines."""
    results: list[str] = []
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = re.sub(r"^(?:[-*•]|\d+[.)]|Q\d*[:.])\s*", "", line).strip()
        if len(line) > 2:
            results.append(line)
        if len(results) >= limit:
            break
    return results


def generate(prompt: str) -> str:
    """Call Gemini, retrying other models if the primary is unavailable."""
    last_error: Exception | None = None
    for model in get_model_candidates():
        try:
            # Keep a strong reference: the SDK closes its HTTP client when garbage collected.
            client = get_client()
            response = client.models.generate_content(
                model=model, contents=prompt
            )
            return (getattr(response, "text", "") or "").strip()
        except AIServiceError:
            raise
        except Exception as exc:  # network, quota, model demand, etc.
            last_error = exc
    raise AIServiceError(str(last_error))
