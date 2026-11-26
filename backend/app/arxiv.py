"""Fetch, parse and sample recent computational research papers from arXiv.

The parser and sampler are pure functions so they can be unit-tested without
network access. Browser requests go through our own API because arXiv does not
send CORS headers.
"""

from __future__ import annotations

import random
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from typing import Any

ARXIV_API_URL = "https://export.arxiv.org/api/query"
COMPUTATIONAL_CATEGORIES = (
    "cs.LG",  # Machine Learning
    "cs.AI",  # Artificial Intelligence
    "cs.CV",  # Computer Vision and Pattern Recognition
    "cs.CL",  # Computation and Language
    "cs.RO",  # Robotics
    "cs.NE",  # Neural and Evolutionary Computing
    "stat.ML",  # Machine Learning (Statistics)
    "q-fin.CP",  # Computational Finance
)
SEARCH_QUERY = " OR ".join(f"cat:{category}" for category in COMPUTATIONAL_CATEGORIES)
SOURCE_URL = "https://arxiv.org/"

ATOM = "{http://www.w3.org/2005/Atom}"
ARXIV = "{http://arxiv.org/schemas/atom}"

POOL_SIZE = 300
DEFAULT_COUNT = 60
RECENT_DAYS = 30
CACHE_TTL_SECONDS = 15 * 60
USER_AGENT = "PaperDigest/2.0 (educational demo)"

_pool_cache: dict[str, Any] = {"papers": None, "fetched_at": 0.0}


def clean_text(value: str | None) -> str:
    """Collapse whitespace in Atom text nodes."""
    return re.sub(r"\s+", " ", value or "").strip()


def paper_id(raw_id: str) -> str:
    """Turn an arXiv abs URL/ID into a bare versionless ID."""
    value = raw_id.rstrip("/").rsplit("/", 1)[-1]
    return re.sub(r"v\d+$", "", value)


def parse_arxiv_feed(xml_text: str) -> list[dict[str, Any]]:
    """Parse an arXiv Atom feed into plain paper dictionaries."""
    root = ET.fromstring(xml_text)
    papers: list[dict[str, Any]] = []

    for entry in root.findall(f"{ATOM}entry"):
        raw_id = clean_text(entry.findtext(f"{ATOM}id"))
        if not raw_id:
            continue

        abs_url = ""
        pdf_url = ""
        for link in entry.findall(f"{ATOM}link"):
            href = link.get("href", "")
            if link.get("rel", "") == "alternate":
                abs_url = href
            if link.get("title", "").lower() == "pdf" or href.endswith(".pdf"):
                pdf_url = href

        authors = [
            clean_text(author.findtext(f"{ATOM}name"))
            for author in entry.findall(f"{ATOM}author")
        ]
        categories = [
            category.get("term", "")
            for category in entry.findall(f"{ATOM}category")
        ]
        primary = entry.find(f"{ARXIV}primary_category")

        papers.append(
            {
                "id": paper_id(raw_id),
                "title": clean_text(entry.findtext(f"{ATOM}title")),
                "authors": [author for author in authors if author],
                "abstract": clean_text(entry.findtext(f"{ATOM}summary")),
                "published": clean_text(entry.findtext(f"{ATOM}published")),
                "updated": clean_text(entry.findtext(f"{ATOM}updated")),
                "primaryCategory": (
                    primary.get("term", "") if primary is not None else ""
                ),
                "categories": [cat for cat in categories if cat],
                "pdfUrl": pdf_url,
                "absUrl": abs_url,
                "comment": clean_text(entry.findtext(f"{ARXIV}comment")),
            }
        )

    return papers


def is_recent(paper: dict[str, Any], days: int = RECENT_DAYS, now=None) -> bool:
    published = paper.get("published", "")
    if not published:
        return False
    try:
        published_at = datetime.fromisoformat(published.replace("Z", "+00:00"))
    except ValueError:
        return False
    now = now or datetime.now(timezone.utc)
    return published_at >= now - timedelta(days=days)


def sample_papers(
    papers: list[dict[str, Any]], count: int = DEFAULT_COUNT, seed: str | None = None
) -> list[dict[str, Any]]:
    """Pick a random, reproducible subset of papers."""
    rng = random.Random(seed if seed is not None else date.today().isoformat())
    return rng.sample(papers, min(max(int(count), 1), len(papers)))


def fetch_pool(force: bool = False) -> list[dict[str, Any]]:
    """Fetch the recent computational pool, cached for 15 minutes."""
    now = time.time()
    if (
        not force
        and _pool_cache["papers"] is not None
        and now - _pool_cache["fetched_at"] < CACHE_TTL_SECONDS
    ):
        return _pool_cache["papers"]

    params = urllib.parse.urlencode(
        {
            "search_query": SEARCH_QUERY,
            "start": 0,
            "max_results": POOL_SIZE,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        }
    )
    request = urllib.request.Request(
        f"{ARXIV_API_URL}?{params}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        xml_text = response.read().decode("utf-8", errors="replace")

    papers = parse_arxiv_feed(xml_text)
    recent = [paper for paper in papers if is_recent(paper)]
    pool = recent[:POOL_SIZE] if recent else papers[:POOL_SIZE]

    _pool_cache["papers"] = pool
    _pool_cache["fetched_at"] = now
    return pool


def fetch_papers(
    count: int = DEFAULT_COUNT, seed: str | None = None, force: bool = False
) -> list[dict[str, Any]]:
    """Return `count` randomly sampled computational papers from arXiv."""
    return sample_papers(fetch_pool(force=force), count=count, seed=seed)
