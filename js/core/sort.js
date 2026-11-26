// Pure sorting helpers.

const publishedTime = (paper) => Date.parse(paper.published || "") || 0;

export function sortPapers(papers, mode = "relevance") {
  const copy = [...(papers || [])];
  if (mode === "date") {
    return copy.sort(
      (a, b) =>
        publishedTime(b) - publishedTime(a) ||
        String(a.title || "").localeCompare(String(b.title || ""))
    );
  }
  return copy.sort(
    (a, b) =>
      (b.score || 0) - (a.score || 0) ||
      publishedTime(b) - publishedTime(a) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
}
