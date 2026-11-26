import test from "node:test";
import assert from "node:assert/strict";
import { escapeHTML, paperCardHTML, readingListHTML } from "../js/ui/render.js";

test("escapeHTML prevents attribute and markup injection", () => {
  assert.equal(escapeHTML(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("paperCardHTML uses data attributes instead of inline handlers", () => {
  const html = paperCardHTML(
    {
      id: "2611.32790",
      title: "A Paper",
      authors: ["A. Author"],
      abstract: "Abstract text",
      primaryCategory: "q-fin.CP",
      published: "2026-11-25T00:00:00Z",
      reasons: ["Primary category: q-fin.CP"],
    },
    false
  );
  assert.match(html, /data-action="details" data-id="2611.32790"/);
  assert.match(html, /Primary category: q-fin.CP/);
  assert.doesNotMatch(html, /onclick=/);
});

test("readingListHTML skips stale saved papers instead of crashing", () => {
  const html = readingListHTML(
    [
      { paperId: "missing", status: "To read", priority: "Low", note: "" },
      { paperId: "known", status: "Read", priority: "High", note: "note" },
    ],
    [{ id: "known", title: "Known Paper", authors: ["B. Author"] }]
  );
  assert.match(html, /Known Paper/);
  assert.doesNotMatch(html, /missing/);
});
