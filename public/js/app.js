// PaperDigest feed page: state, rendering and event wiring.

import { collectCategories, filterPapers } from "./core/filter.js";
import { scorePaper } from "./core/scoring.js";
import { sortPapers } from "./core/sort.js";
import { can, normaliseRole, ROLES } from "./core/roles.js";
import { KEYS, readJSON, readText, writeJSON, writeText } from "./core/storage.js";
import { loadPapers } from "./core/papers.js";
import {
  digestHTML,
  escapeHTML,
  interestChipsHTML,
  paperCardHTML,
  readingListHTML,
  sharedListsHTML,
} from "./ui/render.js";

const $ = (id) => document.getElementById(id);

function arrayOr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

const savedInterests = readJSON(KEYS.interests, {});
const state = {
  papers: [],
  live: false,
  interests: {
    topics: arrayOr(savedInterests.topics, ["cs.LG"]),
    keywords: arrayOr(savedInterests.keywords, []),
  },
  readingItems: arrayOr(readJSON(KEYS.readingList, [])),
  role: normaliseRole(readText(KEYS.role, "Student")),
  sharedLists: arrayOr(readJSON(KEYS.sharedLists, [])),
  digest: readJSON(KEYS.digest, null),
  digestSelection: [],
  filters: { query: "", category: "", sort: "relevance" },
  selectedPaperId: null,
};

const modal = new bootstrap.Modal($("paperModal"));

// ---------- derived data ----------

function isSaved(id) {
  return state.readingItems.some((item) => String(item.paperId) === String(id));
}

function visiblePapers() {
  const filtered = filterPapers(state.papers, state.filters);
  const scored = filtered.map((paper) =>
    scorePaper(paper, state.interests)
  );
  return sortPapers(scored, state.filters.sort);
}

// ---------- rendering ----------

function renderFeed() {
  const visible = visiblePapers();
  $("paperTotal").textContent = state.papers.length;
  $("savedTotal").textContent = state.readingItems.length;
  $("resultCount").textContent =
    `Showing ${visible.length} of ${state.papers.length} papers` +
    (state.live ? " · live arXiv feed" : " · saved snapshot");
  $("paperGrid").innerHTML = visible
    .map((paper) => paperCardHTML(paper, isSaved(paper.id)))
    .join("");
  $("noResults").classList.toggle("d-none", visible.length !== 0);
}

function renderInterests() {
  const available = collectCategories(state.papers);
  const canFollow = can(state.role, "followTopics");
  $("interestsArea").classList.toggle("d-none", !canFollow);
  const { topicChips, keywordChips } = interestChipsHTML(
    state.interests.topics,
    state.interests.keywords,
    available
  );
  $("topicChips").innerHTML = topicChips;
  $("keywordChips").innerHTML = keywordChips;
  $("topicTotal").textContent = state.interests.topics.length;
}

function renderReadingList() {
  $("readingList").innerHTML = readingListHTML(state.readingItems, state.papers);
  $("savedCount").textContent = state.readingItems.length;
  $("savedTotal").textContent = state.readingItems.length;
}

function renderSharedLists() {
  const visible = can(state.role, "manageSharedLists");
  $("facultyWorkspace").classList.toggle("d-none", !visible);
  if (visible) {
    $("sharedListsContainer").innerHTML = sharedListsHTML(
      state.sharedLists,
      state.papers
    );
  }
}

function renderDigest() {
  const visible = can(state.role, "publishDigest");
  $("editorWorkspace").classList.toggle("d-none", !visible);
  if (!visible) return;
  $("digestPaperSelect").innerHTML = state.papers
    .map(
      (paper) =>
        `<option value="${escapeHTML(paper.id)}">${escapeHTML(paper.title)}</option>`
    )
    .join("");
  $("digestSelected").innerHTML = state.digestSelection
    .map((id, index) => {
      const paper = state.papers.find((p) => String(p.id) === String(id));
      if (!paper) return "";
      return `<button class="badge text-bg-secondary" data-action="remove-digest" data-index="${index}">
        ${escapeHTML(paper.title.slice(0, 60))} ×</button>`;
    })
    .join("");
  $("publishedDigest").innerHTML = digestHTML(state.digest, state.papers);
}

function renderRole() {
  const role = ROLES[state.role];
  $("roleLabel").textContent = role.label;
  $("roleAreaTitle").textContent = `${role.label} workspace`;
  $("roleAreaDescription").textContent = role.description;
  renderInterests();
  renderSharedLists();
  renderDigest();
}

function renderAll() {
  renderFeed();
  renderReadingList();
  renderRole();
}

function populateCategoryFilter() {
  const select = $("categoryFilter");
  const current = state.filters.category;
  select.innerHTML =
    `<option value="">All categories</option>` +
    collectCategories(state.papers)
      .map(
        ({ category, count }) =>
          `<option value="${escapeHTML(category)}">${escapeHTML(category)} (${count})</option>`
      )
      .join("");
  const exists = [...select.options].some((option) => option.value === current);
  select.value = exists ? current : "";
  if (!exists) state.filters.category = "";
}

// ---------- mutations ----------

function savePaper(id) {
  if (!can(state.role, "savePapers")) return;
  if (isSaved(id)) return;
  state.readingItems.push({
    paperId: String(id),
    status: "To read",
    priority: "Medium",
    note: "",
  });
  writeJSON(KEYS.readingList, state.readingItems);
  renderReadingList();
  renderFeed();
}

function removeItem(id) {
  state.readingItems = state.readingItems.filter(
    (item) => String(item.paperId) !== String(id)
  );
  writeJSON(KEYS.readingList, state.readingItems);
  renderReadingList();
  renderFeed();
}

function updateItem(id, field, value) {
  const item = state.readingItems.find(
    (candidate) => String(candidate.paperId) === String(id)
  );
  if (!item) return;
  if (field === "note" && value.length > 500) return;
  item[field] = value;
  writeJSON(KEYS.readingList, state.readingItems);
}

function persistInterests() {
  writeJSON(KEYS.interests, state.interests);
  renderInterests();
  renderFeed();
}

function toggleTopic(topic) {
  if (!can(state.role, "followTopics")) return;
  const topics = state.interests.topics;
  const index = topics.indexOf(topic);
  if (index === -1) topics.push(topic);
  else topics.splice(index, 1);
  persistInterests();
}

function addKeyword() {
  if (!can(state.role, "followTopics")) return;
  const input = $("keywordInput");
  const keyword = input.value.trim().toLowerCase().slice(0, 40);
  if (!keyword || state.interests.keywords.includes(keyword)) {
    input.value = "";
    return;
  }
  state.interests.keywords.push(keyword);
  input.value = "";
  persistInterests();
}

function removeKeyword(index) {
  if (!can(state.role, "followTopics")) return;
  state.interests.keywords.splice(index, 1);
  persistInterests();
}

function createSharedList() {
  if (!can(state.role, "createSharedLists")) return;
  const titleInput = $("sharedListTitle");
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }
  state.sharedLists.push({
    id: String(Date.now()),
    title,
    description: $("sharedListDescription").value.trim(),
    papers: [],
  });
  writeJSON(KEYS.sharedLists, state.sharedLists);
  titleInput.value = "";
  $("sharedListDescription").value = "";
  renderSharedLists();
}

function findList(listId) {
  return state.sharedLists.find((list) => String(list.id) === String(listId));
}

function addToList(listId) {
  if (!can(state.role, "manageSharedLists")) return;
  const list = findList(listId);
  const select = document.querySelector(`[data-list-select="${CSS.escape(String(listId))}"]`);
  if (!list || !select || !select.value) return;
  list.papers = arrayOr(list.papers);
  if (!list.papers.includes(select.value)) list.papers.push(select.value);
  writeJSON(KEYS.sharedLists, state.sharedLists);
  renderSharedLists();
}

function removeFromList(listId, paperId) {
  if (!can(state.role, "manageSharedLists")) return;
  const list = findList(listId);
  if (!list) return;
  list.papers = arrayOr(list.papers).filter(
    (id) => String(id) !== String(paperId)
  );
  writeJSON(KEYS.sharedLists, state.sharedLists);
  renderSharedLists();
}

function deleteList(listId) {
  if (!can(state.role, "manageSharedLists")) return;
  state.sharedLists = state.sharedLists.filter(
    (list) => String(list.id) !== String(listId)
  );
  writeJSON(KEYS.sharedLists, state.sharedLists);
  renderSharedLists();
}

function publishDigest() {
  if (!can(state.role, "publishDigest")) return;
  if (!state.digestSelection.length) return;
  const title = $("digestTitle").value.trim() || "Weekly Research Digest";
  state.digest = {
    title,
    intro: $("digestIntro").value.trim(),
    papers: [...state.digestSelection],
    publishedAt: new Date().toISOString(),
  };
  writeJSON(KEYS.digest, state.digest);
  renderDigest();
}

function showDetails(id) {
  const paper = state.papers.find((p) => String(p.id) === String(id));
  if (!paper) return;
  state.selectedPaperId = paper.id;
  const scored = scorePaper(paper, state.interests);

  $("modalTitle").textContent = paper.title;
  $("modalBody").innerHTML = `
    <p class="muted small mb-3">${escapeHTML((paper.authors || []).join(", "))} · ${escapeHTML(paper.primaryCategory)} · ${escapeHTML(new Date(paper.published).toLocaleDateString())}</p>
    <p>${escapeHTML(paper.abstract)}</p>
    <p class="small"><strong>Categories:</strong> ${escapeHTML((paper.categories || []).join(", "))}</p>
    ${paper.comment ? `<p class="small"><strong>Comments:</strong> ${escapeHTML(paper.comment)}</p>` : ""}
    <p class="small"><strong>Why shown:</strong> ${scored.reasons.map(escapeHTML).join(", ")}</p>
    <div class="alert alert-info small mb-0">Paper metadata comes from arXiv. Use <strong>Open Paper</strong> for the full PDF or <strong>Read with AI</strong> to study it with the AI companion.</div>
  `;
  const link = $("modalOpenPaper");
  const pdfOrAbs = paper.pdfUrl || paper.absUrl;
  if (pdfOrAbs) {
    link.href = pdfOrAbs;
    link.classList.remove("d-none");
  } else {
    link.classList.add("d-none");
  }
  const saveButton = $("modalSave");
  saveButton.disabled = isSaved(paper.id);
  saveButton.textContent = isSaved(paper.id) ? "Already saved" : "Save to reading list";
  modal.show();
}

function openReader(id) {
  const paper = state.papers.find((p) => String(p.id) === String(id));
  if (!paper) return;
  sessionStorage.setItem(
    "paperdigest-current-paper",
    JSON.stringify({
      ...paper,
      reasons: scorePaper(paper, state.interests).reasons,
    })
  );
  window.location.href = `reader.html?paper=${encodeURIComponent(paper.id)}`;
}

// ---------- events ----------

function wireEvents() {
  $("searchInput").addEventListener("input", (event) => {
    state.filters.query = event.target.value;
    renderFeed();
  });
  $("categoryFilter").addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderFeed();
  });
  $("sortSelect").addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    renderFeed();
  });
  $("clearFilters").addEventListener("click", () => {
    state.filters = { query: "", category: "", sort: "relevance" };
    $("searchInput").value = "";
    $("categoryFilter").value = "";
    $("sortSelect").value = "relevance";
    renderFeed();
  });

  $("roleSelect").value = state.role;
  $("roleSelect").addEventListener("change", (event) => {
    state.role = normaliseRole(event.target.value);
    writeText(KEYS.role, state.role);
    renderRole();
  });

  $("paperGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "details") showDetails(id);
    if (action === "save") savePaper(id);
  });

  $("readingList").addEventListener("change", (event) => {
    const field = event.target.dataset.itemField;
    if (!field) return;
    updateItem(event.target.dataset.id, field, event.target.value);
  });
  $("readingList").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove-item"]');
    if (button) removeItem(button.dataset.id);
  });

  $("topicChips").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="toggle-topic"]');
    if (button) toggleTopic(button.dataset.topic);
  });
  $("keywordChips").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove-keyword"]');
    if (button) removeKeyword(Number(button.dataset.index));
  });
  $("addKeyword").addEventListener("click", addKeyword);
  $("keywordInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") addKeyword();
  });

  $("createListButton").addEventListener("click", createSharedList);
  $("sharedListsContainer").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, listId, id } = button.dataset;
    if (action === "list-add") addToList(listId);
    if (action === "list-remove") removeFromList(listId, id);
    if (action === "delete-list") deleteList(listId);
  });

  $("addDigestPaper").addEventListener("click", () => {
    if (!can(state.role, "publishDigest")) return;
    const id = $("digestPaperSelect").value;
    if (id && !state.digestSelection.includes(id)) {
      state.digestSelection.push(id);
      renderDigest();
    }
  });
  $("digestSelected").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove-digest"]');
    if (!button) return;
    state.digestSelection.splice(Number(button.dataset.index), 1);
    renderDigest();
  });
  $("publishDigest").addEventListener("click", publishDigest);
  $("publishedDigest").addEventListener("click", (event) => {
    if (!event.target.closest('[data-action="delete-digest"]')) return;
    state.digest = null;
    writeJSON(KEYS.digest, null);
    renderDigest();
  });

  $("modalSave").addEventListener("click", () => {
    if (state.selectedPaperId !== null) savePaper(state.selectedPaperId);
    $("modalSave").disabled = true;
    $("modalSave").textContent = "Saved";
  });
  $("modalReadAI").addEventListener("click", () => {
    if (state.selectedPaperId !== null) openReader(state.selectedPaperId);
  });
}

// ---------- init ----------

async function init() {
  wireEvents();
  const result = await loadPapers();
  state.papers = result.papers;
  state.live = result.live;
  if (result.notice) {
    $("sourceNotice").textContent = result.notice;
    $("sourceNotice").classList.remove("d-none");
  }
  populateCategoryFilter();
  renderAll();
}

init();
