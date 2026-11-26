import test from "node:test";
import assert from "node:assert/strict";
import { readJSON, readText, writeJSON, writeText } from "../js/core/storage.js";

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test("readJSON returns the fallback for missing or corrupt values", () => {
  globalThis.localStorage = fakeStorage();
  assert.deepEqual(readJSON("missing", { a: 1 }), { a: 1 });
  localStorage.setItem("bad", "{not json");
  assert.deepEqual(readJSON("bad", []), []);
  localStorage.setItem("null", "null");
  assert.deepEqual(readJSON("null", ["fallback"]), ["fallback"]);
});

test("writeJSON and writeText round-trip values", () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(writeJSON("list", [{ paperId: "2611.32790" }]), true);
  assert.deepEqual(readJSON("list", []), [{ paperId: "2611.32790" }]);
  assert.equal(writeText("role", "Faculty"), true);
  assert.equal(readText("role", "Student"), "Faculty");
});

test("storage helpers work without localStorage (Node default)", () => {
  delete globalThis.localStorage;
  assert.deepEqual(readJSON("anything", 42), 42);
  assert.equal(writeJSON("anything", 42), false);
});
