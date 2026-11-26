// Pure paper filtering helpers.

export function searchableText(paper) {
  const authors = Array.isArray(paper.authors) ? paper.authors.join(" ") : paper.authors || "";
  const categories = Array.isArray(paper.categories) ? paper.categories.join(" ") : paper.categories || "";
  return [
    paper.title || "",
    authors,
    paper.abstract || "",
    categories,
    paper.comment || "",
  ]
    .join(" ")
    .toLowerCase();
}

export function filterPapers(papers, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const category = String(filters.category || "");

  return (papers || []).filter((paper) => {
    if (query && !searchableText(paper).includes(query)) return false;
    if (category) {
      const inCategories = Array.isArray(paper.categories) && paper.categories.includes(category);
      if (paper.primaryCategory !== category && !inCategories) return false;
    }
    return true;
  });
}

export function collectCategories(papers) {
  const counts = new Map();
  for (const paper of papers || []) {
    const cats = Array.isArray(paper.categories) ? paper.categories : [];
    for (const cat of cats) {
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, count]) => ({ category, count }));
}
