// Relevance scoring: computed from a student's interests, not stored on papers.

import { searchableText } from "./filter.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function asList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function scorePaper(paper, interests = {}, now = new Date()) {
  const topics = asList(interests.topics).filter(Boolean);
  const keywords = asList(interests.keywords)
    .map((word) => String(word).trim().toLowerCase())
    .filter(Boolean);

  let score = 0;
  const reasons = [];
  const text = searchableText(paper);
  const title = String(paper.title || "").toLowerCase();
  const abstract = String(paper.abstract || "").toLowerCase();
  const categories = asList(paper.categories);

  for (const topic of topics) {
    if (paper.primaryCategory === topic) {
      score += 4;
      reasons.push(`Primary category: ${topic}`);
    } else if (categories.includes(topic)) {
      score += 2;
      reasons.push(`Cross-listed: ${topic}`);
    }
  }

  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      score += 3;
      reasons.push(`Keyword in title: ${keyword}`);
    } else if (abstract.includes(keyword)) {
      score += 2;
      reasons.push(`Keyword in abstract: ${keyword}`);
    }
  }

  const published = Date.parse(paper.published || "");
  if (!Number.isNaN(published)) {
    const days = Math.max(0, Math.floor((now.getTime() - published) / DAY_MS));
    if (days <= 2) {
      score += 2;
      reasons.push(days === 0 ? "Published today" : `Published ${days} day${days === 1 ? "" : "s"} ago`);
    } else if (days <= 7) {
      score += 1;
      reasons.push(`Published ${days} days ago`);
    }
  }

  if (reasons.length === 0) {
    reasons.push("Recent computational paper from arXiv");
  }

  return { ...paper, score, reasons };
}
