import test from "node:test";
import assert from "node:assert/strict";
import { sortPapers } from "../public/js/core/sort.js";

const papers = [
  { id: "a", title: "Alpha", score: 3, published: "2026-11-20T00:00:00Z" },
  { id: "b", title: "Beta", score: 9, published: "2026-11-10T00:00:00Z" },
  { id: "c", title: "Charlie", score: 9, published: "2026-11-25T00:00:00Z" },
];

test("relevance sort uses score then date", () => {
  assert.deepEqual(
    sortPapers(papers, "relevance").map((p) => p.id),
    ["c", "b", "a"]
  );
});

test("date sort uses newest first", () => {
  assert.deepEqual(
    sortPapers(papers, "date").map((p) => p.id),
    ["c", "a", "b"]
  );
});

test("sortPapers does not mutate the input array", () => {
  const copy = [...papers];
  sortPapers(papers, "date");
  assert.deepEqual(papers, copy);
});
