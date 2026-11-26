// Browser-side API client. All paper and AI data comes from our own backend,
// which proxies arXiv (the arXiv API does not allow direct browser requests).

export const API_BASE = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.detail || `Request failed (${response.status})`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function post(path, body, timeout) {
  return request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout,
    }
  );
}

export function fetchPapers() {
  return request("/api/papers", { timeout: 20000 }).then((data) => data.papers || []);
}

export function summarisePaper(paper) {
  return post("/api/summarize", { paper }, 45000).then((data) => data.summary || "");
}

export function suggestQuestions(paper) {
  return post("/api/questions", { paper }, 45000).then((data) => data.questions || []);
}

export function askQuestion(paper, question) {
  return post("/api/ask", { paper, question }, 60000).then((data) => data.answer || "");
}

export function generateNotes(paper) {
  return post("/api/notes", { paper }, 45000).then((data) => data.notes || []);
}
