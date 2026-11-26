// HTML templates. No event wiring here — pages use data-action delegation.

export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

export function escapeAttribute(value) {
  return escapeHTML(value);
}

export function formatDate(iso) {
  const date = new Date(iso || "");
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function shortText(text, length = 240) {
  const value = String(text || "");
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;
}

export function paperCardHTML(paper, saved) {
  const id = escapeAttribute(paper.id);
  const reasons = (paper.reasons || [])
    .map((reason) => `<span class="reason">${escapeHTML(reason)}</span>`)
    .join("");
  return `
    <div class="col-12 col-md-6 col-xl-4">
      <article class="paper-card p-3 h-100 d-flex flex-column">
        <div class="d-flex justify-content-between gap-2 mb-2">
          <span class="badge rounded-pill topic">${escapeHTML(paper.primaryCategory || "q-fin.CP")}</span>
          <span class="small muted">${formatDate(paper.published)}</span>
        </div>
        <h3 class="h6 fw-bold mb-2">${escapeHTML(paper.title)}</h3>
        <p class="small muted mb-2">${escapeHTML((paper.authors || []).join(", "))}</p>
        <p class="small mb-2">${escapeHTML(shortText(paper.abstract))}</p>
        <div class="mb-3">${reasons}</div>
        <div class="mt-auto d-flex justify-content-between align-items-center gap-2">
          <button class="btn btn-sm btn-outline-primary" data-action="details" data-id="${id}">View details</button>
          <button class="btn btn-sm ${saved ? "btn-success" : "btn-primary"}"
                  data-action="save" data-id="${id}" ${saved ? "disabled" : ""}>
            ${saved ? "Saved" : "＋ Save"}
          </button>
        </div>
      </article>
    </div>`;
}

export function readingListHTML(items, papers) {
  if (!items.length) {
    return `<div class="empty">Your reading list is empty.<br><span class="small">Save a paper from the feed to see it here.</span></div>`;
  }
  const rows = items
    .map((item) => {
      const paper = papers.find((p) => String(p.id) === String(item.paperId));
      if (!paper) return ""; // ignore stale entries instead of crashing
      const id = escapeAttribute(paper.id);
      const statusOptions = ["To read", "Reading", "Read", "Archived"]
        .map((s) => `<option ${item.status === s ? "selected" : ""}>${s}</option>`)
        .join("");
      const priorityOptions = ["Low", "Medium", "High"]
        .map((s) => `<option ${item.priority === s ? "selected" : ""}>${s}</option>`)
        .join("");
      return `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHTML(paper.title)}</div>
            <div class="small muted">${escapeHTML((paper.authors || []).join(", "))}</div>
          </td>
          <td><select class="form-select form-select-sm" data-item-field="status" data-id="${id}">${statusOptions}</select></td>
          <td><select class="form-select form-select-sm" data-item-field="priority" data-id="${id}">${priorityOptions}</select></td>
          <td><input class="form-control form-control-sm" maxlength="500" placeholder="Add a note"
                     value="${escapeAttribute(item.note || "")}" data-item-field="note" data-id="${id}"></td>
          <td><button class="btn btn-sm btn-outline-danger" data-action="remove-item" data-id="${id}">Remove</button></td>
        </tr>`;
    })
    .join("");
  return `
    <div class="table-responsive">
      <table class="table align-middle">
        <thead><tr><th>Paper</th><th>Status</th><th>Priority</th><th>Note</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function sharedListsHTML(lists, papers) {
  if (!lists.length) {
    return `<p class="muted small mb-0">No shared reading lists yet. Create your first one!</p>`;
  }
  return lists
    .map((list) => {
      const listId = escapeAttribute(list.id);
      const paperIds = Array.isArray(list.papers) ? list.papers : [];
      const chips = paperIds
        .map((id) => {
          const paper = papers.find((p) => String(p.id) === String(id));
          if (!paper) return "";
          return `<span class="badge text-bg-light border me-1 mb-1">
            ${escapeHTML(shortText(paper.title, 60))}
            <button class="btn-close btn-close-sm ms-1" aria-label="Remove"
                    data-action="list-remove" data-list-id="${listId}" data-id="${escapeAttribute(paper.id)}"></button>
          </span>`;
        })
        .join("");
      const options = papers
        .map((paper) => `<option value="${escapeAttribute(paper.id)}">${escapeHTML(shortText(paper.title, 90))}</option>`)
        .join("");
      return `
        <div class="border rounded-3 p-3 mb-3">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <h3 class="h6 fw-bold mb-1">${escapeHTML(list.title)}</h3>
              <p class="small muted mb-2">${escapeHTML(list.description || "")}</p>
            </div>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-list" data-list-id="${listId}">Delete</button>
          </div>
          <span class="badge bg-light text-dark">${paperIds.length} paper${paperIds.length === 1 ? "" : "s"}</span>
          <div class="mt-2">${chips || `<span class="small muted">No papers added yet.</span>`}</div>
          <div class="d-flex gap-2 mt-3">
            <select class="form-select form-select-sm" data-list-select="${listId}">${options}</select>
            <button class="btn btn-sm btn-outline-primary" data-action="list-add" data-list-id="${listId}">Add paper</button>
          </div>
        </div>`;
    })
    .join("");
}

export function digestHTML(digest, papers) {
  if (!digest) {
    return `<p class="muted small mb-0">No digest published yet.</p>`;
  }
  const items = (digest.papers || [])
    .map((id) => {
      const paper = papers.find((p) => String(p.id) === String(id));
      if (!paper) return "";
      return `<li class="mb-2">
        <strong>${escapeHTML(paper.title)}</strong>
        <div class="small muted">${escapeHTML((paper.authors || []).join(", "))}</div>
        <a class="small" href="${escapeAttribute(paper.pdfUrl)}" target="_blank" rel="noopener noreferrer">Open PDF</a>
      </li>`;
    })
    .join("");
  return `
    <div class="border rounded-3 p-3">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h3 class="h6 fw-bold mb-1">${escapeHTML(digest.title)}</h3>
          <div class="small muted">Published ${formatDate(digest.publishedAt)}</div>
        </div>
        <button class="btn btn-sm btn-outline-danger" data-action="delete-digest">Delete</button>
      </div>
      <p class="small mt-2 mb-3">${escapeHTML(digest.intro || "")}</p>
      <ol class="mb-0">${items}</ol>
    </div>`;
}

export function interestChipsHTML(topics, keywords, availableTopics) {
  const topicChips = availableTopics
    .map(({ category }) => {
      const active = topics.includes(category);
      return `<button class="badge rounded-pill border-0 ${active ? "text-bg-primary" : "text-bg-light"}"
              data-action="toggle-topic" data-topic="${escapeAttribute(category)}">${escapeHTML(category)}</button>`;
    })
    .join("");
  const keywordChips = keywords
    .map(
      (word, index) => `<button class="badge rounded-pill text-bg-secondary"
        data-action="remove-keyword" data-index="${index}">${escapeHTML(word)} ×</button>`
    )
    .join("");
  return { topicChips, keywordChips };
}
