import test from "node:test";
import assert from "node:assert/strict";

import { fail, ok, sendError, sendOk } from "../src/utils/response.js";

function createFakeResponse() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

test("ok/fail helpers produce the API envelope", () => {
  assert.deepEqual(ok({ projects: [] }, "done"), {
    ok: true,
    data: { projects: [] },
    message: "done"
  });

  assert.deepEqual(fail("not_found", "Missing"), {
    ok: false,
    error: "not_found",
    message: "Missing"
  });
});

test("sendOk writes JSON envelope with no-store headers", () => {
  const res = createFakeResponse();

  sendOk(res, 201, { id: 1 }, "Created");

  assert.equal(res.status, 201);
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(res.headers["cache-control"], "no-store");
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    data: { id: 1 },
    message: "Created"
  });
});

test("sendError writes JSON error envelope", () => {
  const res = createFakeResponse();

  sendError(res, 404, "not_found", "Missing");

  assert.equal(res.status, 404);
  assert.deepEqual(JSON.parse(res.body), {
    ok: false,
    error: "not_found",
    message: "Missing"
  });
});
