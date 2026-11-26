// PaperDigest research reader: real arXiv PDF + AI summary, questions, chat and notes.

import {
  askQuestion,
  generateNotes,
  suggestQuestions,
  summarisePaper,
} from "./core/api.js";
import { KEYS, readJSON, writeJSON } from "./core/storage.js";
import { PAPER_SNAPSHOT } from "./data/snapshot.js";

const $ = (id) => document.getElementById(id);
const paperId = new URLSearchParams(location.search).get("paper");

function getPaper() {
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem("paperdigest-current-paper") || "null");
  } catch {
    stored = null;
  }
  if (stored && (!paperId || String(stored.id) === String(paperId))) return stored;
  const legacy = readJSON("paperdigest-current-paper", null);
  if (legacy && (!paperId || String(legacy.id) === String(paperId))) return legacy;
  return PAPER_SNAPSHOT.papers.find((p) => String(p.id) === String(paperId)) || null;
}

const paper = getPaper();

// ---------- PDF panel ----------

function setupPaperPanel() {
  if (!paper) {
    $("paperTitle").textContent = "No paper selected";
    $("paperInfo").textContent = "Open a paper from the feed first.";
    $("summaryBox").textContent = "Select a paper to generate a summary.";
    $("questionChips").textContent = "";
    return false;
  }
  $("paperTitle").textContent = paper.title;
  $("paperInfo").textContent =
    `${(paper.authors || []).join(", ")} · ${paper.primaryCategory} · ${paper.published || ""}`;

  const viewer = $("pdfViewer");
  const openPdf = $("openPdf");
  if (paper.pdfUrl) {
    viewer.src = paper.pdfUrl;
    openPdf.href = paper.pdfUrl;
  } else {
    viewer.classList.add("d-none");
    $("pdfFallback").classList.remove("d-none");
    openPdf.href = paper.absUrl || "#";
    openPdf.classList.toggle("d-none", !paper.absUrl);
  }
  return true;
}

// ---------- AI panel ----------

function appendMessage(text, className) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  $("chatMessages").appendChild(element);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  return element;
}

async function ask(question) {
  if (!paper || !question.trim()) return;
  appendMessage(question, "user-message");
  $("chatInput").value = "";
  const answerElement = appendMessage("Thinking…", "ai-message");
  try {
    const answer = await askQuestion(paper, question);
    answerElement.textContent = answer || "No answer returned.";
    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-sm btn-outline-primary mt-2 d-block";
    saveButton.textContent = "Save to Research Notes";
    saveButton.addEventListener("click", () => {
      researchNotes.push({ text: answer, type: "ai" });
      saveNotes();
      displayNotes();
      saveButton.disabled = true;
      saveButton.textContent = "Saved!";
    });
    answerElement.appendChild(saveButton);
  } catch (error) {
    answerElement.textContent = `AI unavailable: ${error.message}`;
  }
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}

async function loadSummary() {
  if (!paper) return;
  try {
    const summary = await summarisePaper(paper);
    $("summaryBox").textContent = summary || "No summary returned.";
  } catch (error) {
    $("summaryBox").textContent = `Summary unavailable: ${error.message}`;
  }
}

async function loadQuestions() {
  if (!paper) return;
  try {
    const questions = await suggestQuestions(paper);
    $("questionChips").innerHTML = questions.length
      ? questions
          .map(
            (question, index) =>
              `<button class="btn btn-sm btn-outline-primary question-chip" data-question-index="${index}">${escapeHTML(question)}</button>`
          )
          .join("")
      : `<span class="small text-secondary">No suggestions returned.</span>`;
  } catch (error) {
    $("questionChips").innerHTML = `<span class="small text-secondary">Suggestions unavailable: ${escapeHTML(error.message)}</span>`;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

// ---------- research notes ----------

const notesKey = KEYS.notes(paper ? paper.id : "general");
const storedNotes = readJSON(notesKey, []);
let researchNotes = (Array.isArray(storedNotes) ? storedNotes : []).map((note) =>
  typeof note === "string" ? { text: note, type: "manual" } : note
);

function saveNotes() {
  writeJSON(notesKey, researchNotes);
}

function displayNotes() {
  const container = $("savedNotes");
  container.innerHTML = "";
  const filter = $("noteFilter").value;
  researchNotes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => filter === "all" || note.type === filter)
    .forEach(({ note, index }) => {
      const card = document.createElement("div");
      card.className = "saved-note";

      const label = document.createElement("small");
      label.className = "text-primary";
      label.textContent = note.type === "ai" ? "AI-Generated Note" : "Manual Note";

      const text = document.createElement("p");
      text.className = "mb-2";
      text.textContent = note.text;

      const editButton = document.createElement("button");
      editButton.className = "btn btn-sm btn-outline-primary me-2";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        $("noteInput").value = note.text;
        $("charCount").textContent = note.text.length;
        researchNotes.splice(index, 1);
        saveNotes();
        displayNotes();
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn-sm btn-outline-danger";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        researchNotes.splice(index, 1);
        saveNotes();
        displayNotes();
      });

      card.append(label, text, editButton, deleteButton);
      container.appendChild(card);
    });
}

// ---------- events ----------

$("collapseAI").addEventListener("click", () => {
  $("aiPanel").classList.add("collapsed");
  $("askAIButton").style.display = "block";
});

$("sendButton").addEventListener("click", () => ask($("chatInput").value));
$("chatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") ask($("chatInput").value);
});
$("questionChips").addEventListener("click", (event) => {
  const button = event.target.closest("[data-question-index]");
  if (!button) return;
  const index = Number(button.dataset.questionIndex);
  const question = button.textContent;
  ask(question);
  button.disabled = true;
});

$("generateNotesButton").addEventListener("click", async () => {
  if (!paper) return;
  $("aiStatus").textContent = "Generating notes…";
  try {
    const notes = await generateNotes(paper);
    notes.forEach((text) => researchNotes.push({ text, type: "ai" }));
    saveNotes();
    displayNotes();
    $("aiStatus").textContent = `${notes.length} AI notes added to your notes.`;
  } catch (error) {
    $("aiStatus").textContent = `Could not generate notes: ${error.message}`;
  }
});

$("noteInput").addEventListener("input", () => {
  $("charCount").textContent = $("noteInput").value.length;
});
$("saveNoteButton").addEventListener("click", () => {
  const text = $("noteInput").value.trim();
  if (!text) {
    alert("Please write a note first.");
    return;
  }
  researchNotes.push({ text, type: "manual" });
  saveNotes();
  $("noteInput").value = "";
  $("charCount").textContent = "0";
  displayNotes();
});
$("clearNotesButton").addEventListener("click", () => {
  if (!confirm("Are you sure you want to delete all notes for this paper?")) return;
  researchNotes = [];
  saveNotes();
  displayNotes();
  $("noteInput").value = "";
  $("charCount").textContent = "0";
});
$("noteFilter").addEventListener("change", displayNotes);

// ---------- start ----------

if (setupPaperPanel()) {
  loadSummary();
  loadQuestions();
}
displayNotes();
