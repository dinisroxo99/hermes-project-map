import test from "node:test";
import assert from "node:assert/strict";

import { createRouter } from "../src/utils/router.js";

test("router matches static and parameterized routes", () => {
  const router = createRouter();

  router.add("GET", "/api/health", async () => {});
  router.add("GET", "/api/explore/:project/search", async () => {});

  const health = router.match("GET", "/api/health");
  assert.ok(health);
  assert.deepEqual(health.params, {});

  const search = router.match("GET", "/api/explore/faturas-backend/search");
  assert.ok(search);
  assert.deepEqual(search.params, { project: "faturas-backend" });
});

test("router respects method and segment count", () => {
  const router = createRouter();
  router.add("GET", "/api/projects/:name", async () => {});

  assert.equal(router.match("POST", "/api/projects/demo"), null);
  assert.equal(router.match("GET", "/api/projects/demo/extra"), null);
});

test("router decodes URL params", () => {
  const router = createRouter();
  router.add("GET", "/api/projects/:name", async () => {});

  const result = router.match("GET", "/api/projects/Faturas%20API");
  assert.ok(result);
  assert.equal(result.params.name, "Faturas API");
});
