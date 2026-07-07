import test from "node:test";
import assert from "node:assert/strict";

import {
  isPathSafe,
  parseLimit,
  validateNodeId,
  validateProjectName,
  validateSearchQuery
} from "../src/utils/validation.js";

test("validateProjectName rejects traversal and path separators", () => {
  assert.deepEqual(validateProjectName("faturas-backend"), { valid: true });
  assert.equal(validateProjectName("../secret").valid, false);
  assert.equal(validateProjectName("folder/project").valid, false);
  assert.equal(validateProjectName("folder\\project").valid, false);
});

test("validateNodeId and validateSearchQuery reject missing and very long values", () => {
  assert.equal(validateNodeId("").valid, false);
  assert.equal(validateNodeId("x".repeat(501)).valid, false);
  assert.deepEqual(validateNodeId("file.cs#Class"), { valid: true });

  assert.equal(validateSearchQuery("").valid, false);
  assert.equal(validateSearchQuery("x".repeat(501)).valid, false);
  assert.deepEqual(validateSearchQuery("Invoice"), { valid: true });
});

test("parseLimit clamps invalid and out-of-range limits", () => {
  assert.equal(parseLimit("", 500, 1, 1000), 500);
  assert.equal(parseLimit("0", 500, 1, 1000), 500);
  assert.equal(parseLimit("25.8", 500, 1, 1000), 25);
  assert.equal(parseLimit("5000", 500, 1, 1000), 1000);
});

test("isPathSafe keeps resolved paths inside root", () => {
  assert.equal(isPathSafe("/projects/Faturas/src/File.cs", "/projects/Faturas"), true);
  assert.equal(isPathSafe("/projects/Faturas", "/projects/Faturas"), true);
  assert.equal(isPathSafe("/projects/Faturas2/src/File.cs", "/projects/Faturas"), false);
});
