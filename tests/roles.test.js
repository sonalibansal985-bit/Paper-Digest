import test from "node:test";
import assert from "node:assert/strict";
import { can, normaliseRole, ROLE_NAMES } from "../js/core/roles.js";

test("all three roles are defined", () => {
  assert.deepEqual(ROLE_NAMES, ["Student", "Faculty", "Club Editor"]);
});

test("capabilities match the product rules", () => {
  assert.equal(can("Student", "followTopics"), true);
  assert.equal(can("Student", "createSharedLists"), false);
  assert.equal(can("Faculty", "createSharedLists"), true);
  assert.equal(can("Faculty", "publishDigest"), false);
  assert.equal(can("Club Editor", "publishDigest"), true);
  assert.equal(can("Club Editor", "followTopics"), false);
});

test("unknown roles fall back to Student", () => {
  assert.equal(normaliseRole("Admin"), "Student");
  assert.equal(can("Admin", "followTopics"), true);
});
