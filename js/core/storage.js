// Small, defensive LocalStorage wrapper used by PaperDigest.

export const KEYS = {
  readingList: "paperdigest-reading-v1",
  role: "paperdigest-role",
  sharedLists: "paperdigest-shared-lists",
  interests: "paperdigest-interests-v2",
  digest: "paperdigest-digest-v1",
  notes: (paperId) => `paperdigest-research-notes-${paperId}`,
};

function hasStorage() {
  return typeof localStorage !== "undefined";
}

export function readJSON(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readText(key, fallback = "") {
  if (!hasStorage()) return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeText(key, value) {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
