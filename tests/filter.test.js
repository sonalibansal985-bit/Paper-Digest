import test from "node:test";
import assert from "node:assert/strict";
import { collectCategories, filterPapers, searchableText } from "../public/js/core/filter.js";

const papers = [
  {
    id: "2611.32790",
    title: "Delta-Vega Hedging with Deep Reinforcement Learning",
    authors: ["Michele Colombi"],
    abstract: "A study of option hedging with PPO.",
    categories: ["q-fin.CP", "q-fin.RM"],
    primaryCategory: "q-fin.CP",
    comment: "34 pages",
  },
  {
    id: "2611.25344",
    title: "Quantum Calibration of Local-Volatility Surfaces",
    authors: ["Kentaro Hoshisashi"],
    abstract: "Sparse option quotes and calibration.",
    categories: ["q-fin.CP"],
    primaryCategory: "q-fin.CP",
  },
];

test("searchableText includes title, authors, abstract, categories and comment", () => {
  const text = searchableText(papers[0]);
  assert.match(text, /delta-vega hedging/);
  assert.match(text, /michele colombi/);
  assert.match(text, /q-fin\.rm/);
  assert.match(text, /34 pages/);
});

test("filterPapers matches query, category, or both", () => {
  assert.equal(filterPapers(papers, { query: "ppo" }).length, 1);
  assert.equal(filterPapers(papers, { query: "quantum" }).length, 1);
  assert.equal(filterPapers(papers, { category: "q-fin.RM" }).length, 1);
  assert.equal(
    filterPapers(papers, { query: "hedging", category: "q-fin.CP" }).length,
    1
  );
  assert.equal(filterPapers(papers, { query: "nothingmatches" }).length, 0);
});

test("collectCategories counts cross-listed categories", () => {
  const categories = collectCategories(papers);
  assert.deepEqual(categories, [
    { category: "q-fin.CP", count: 2 },
    { category: "q-fin.RM", count: 1 },
  ]);
});
