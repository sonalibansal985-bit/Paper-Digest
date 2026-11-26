// Load papers from the live arXiv feed with a committed offline snapshot fallback.

import { fetchPapers } from "./api.js";
import { PAPER_SNAPSHOT } from "../data/snapshot.js";

function normalize(paper) {
  return {
    id: String(paper.id || ""),
    title: paper.title || "Untitled paper",
    authors: Array.isArray(paper.authors) ? paper.authors : [paper.authors || ""].filter(Boolean),
    abstract: paper.abstract || "",
    published: paper.published || "",
    updated: paper.updated || "",
    primaryCategory: paper.primaryCategory || "",
    categories: Array.isArray(paper.categories) ? paper.categories : [],
    pdfUrl: paper.pdfUrl || paper.absUrl || "",
    absUrl: paper.absUrl || "",
    comment: paper.comment || "",
  };
}

export async function loadPapers() {
  try {
    const live = await fetchPapers();
    if (Array.isArray(live) && live.length > 0) {
      return {
        papers: live.map(normalize),
        live: true,
        notice: "",
      };
    }
  } catch (error) {
    return {
      papers: PAPER_SNAPSHOT.papers.map(normalize),
      live: false,
      notice: `Live arXiv feed unavailable (${error.message}). Showing the saved snapshot from ${new Date(PAPER_SNAPSHOT.generatedAt).toLocaleDateString()}.`,
    };
  }
  return {
    papers: PAPER_SNAPSHOT.papers.map(normalize),
    live: false,
    notice: "No live papers returned. Showing the saved snapshot.",
  };
}

export function findPaper(papers, id) {
  if (id === null || id === undefined) return null;
  return (papers || []).find((paper) => String(paper.id) === String(id)) || null;
}
