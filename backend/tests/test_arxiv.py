"""Unit tests for the arXiv Atom parser (no network calls)."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app.arxiv import is_recent, paper_id, parse_arxiv_feed, sample_papers  # noqa: E402

FEED = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2611.32790v1</id>
    <title>  Delta-Vega   Hedging  </title>
    <summary> A study of hedging. </summary>
    <published>2026-11-24T15:18:34Z</published>
    <updated>2026-11-24T15:18:34Z</updated>
    <link href="https://arxiv.org/abs/2611.32790v1" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2611.32790v1" rel="related" type="application/pdf" title="pdf"/>
    <category term="q-fin.CP" scheme="http://arxiv.org/schemas/atom"/>
    <category term="q-fin.RM" scheme="http://arxiv.org/schemas/atom"/>
    <arxiv:primary_category term="q-fin.CP"/>
    <arxiv:comment>34 pages, 10 figures</arxiv:comment>
    <author><name>Michele Colombi</name></author>
  </entry>
</feed>
"""


class ArxivParserTests(unittest.TestCase):
    def test_paper_id_strips_url_and_version(self):
        self.assertEqual(paper_id("http://arxiv.org/abs/2611.32790v1"), "2611.32790")
        self.assertEqual(paper_id("2611.32790v3"), "2611.32790")

    def test_parse_feed_maps_all_fields(self):
        papers = parse_arxiv_feed(FEED)
        self.assertEqual(len(papers), 1)
        paper = papers[0]
        self.assertEqual(paper["id"], "2611.32790")
        self.assertEqual(paper["title"], "Delta-Vega Hedging")
        self.assertEqual(paper["abstract"], "A study of hedging.")
        self.assertEqual(paper["authors"], ["Michele Colombi"])
        self.assertEqual(paper["primaryCategory"], "q-fin.CP")
        self.assertEqual(paper["categories"], ["q-fin.CP", "q-fin.RM"])
        self.assertEqual(paper["pdfUrl"], "https://arxiv.org/pdf/2611.32790v1")
        self.assertEqual(paper["absUrl"], "https://arxiv.org/abs/2611.32790v1")
        self.assertEqual(paper["comment"], "34 pages, 10 figures")

    def test_is_recent_uses_published_date(self):
        paper = {"published": "2026-11-24T15:18:34Z"}
        now = datetime(2026, 11, 26, tzinfo=timezone.utc)
        self.assertTrue(is_recent(paper, days=7, now=now))
        self.assertFalse(is_recent(paper, days=1, now=now))
        self.assertFalse(is_recent({}, now=now))

    def test_sample_papers_is_random_but_reproducible(self):
        pool = [{"id": str(i)} for i in range(200)]
        first = sample_papers(pool, count=60, seed="demo")
        second = sample_papers(pool, count=60, seed="demo")
        other = sample_papers(pool, count=60, seed="other")
        self.assertEqual(len(first), 60)
        self.assertEqual(len({p["id"] for p in first}), 60)
        self.assertEqual(first, second)
        self.assertNotEqual(first, other)


if __name__ == "__main__":
    unittest.main()
