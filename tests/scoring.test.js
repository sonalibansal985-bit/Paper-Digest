import test from "node:test";
import assert from "node:assert/strict";
import { scorePaper } from "../public/js/core/scoring.js";

const now = new Date("2026-11-26T12:00:00Z");
const paper = {
  id: "2611.32790",
  title: "Delta-Vega Hedging with Deep Reinforcement Learning",
  abstract: "We study hedging with PPO.",
  primaryCategory: "q-fin.CP",
  categories: ["q-fin.CP", "q-fin.RM"],
  published: "2026-11-25T10:00:00Z",
};

test("scorePaper rewards followed topics and keywords with visible reasons", () => {
  const scored = scorePaper(
    paper,
    { topics: ["q-fin.CP"], keywords: ["hedging"] },
    now
  );
  assert.equal(scored.score, 4 + 3 + 2);
  assert.ok(scored.reasons.includes("Primary category: q-fin.CP"));
  assert.ok(scored.reasons.includes("Keyword in title: hedging"));
  assert.ok(scored.reasons.some((r) => r.startsWith("Published")));
});

test("scorePaper handles cross-lists and missing interests", () => {
  const scored = scorePaper(paper, { topics: ["q-fin.RM"], keywords: [] }, now);
  assert.ok(scored.reasons.includes("Cross-listed: q-fin.RM"));

  const plain = scorePaper(paper, {}, now);
  assert.ok(plain.reasons.length > 0);
  assert.ok(plain.score >= 0);
});

test("scorePaper does not mutate the input paper", () => {
  const original = { ...paper };
  scorePaper(paper, { topics: ["q-fin.CP"] }, now);
  assert.deepEqual(paper, original);
});
