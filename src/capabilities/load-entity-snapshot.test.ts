import assert from "node:assert/strict";
import test from "node:test";
import { loadEntitySnapshot } from "./load-entity-snapshot";

test("loads only declared synthetic objects", () => {
  const found = loadEntitySnapshot("content_steady");
  const missing = loadEntitySnapshot("real_123");

  assert.equal(found.status, "completed");
  assert.equal(found.snapshot?.source, "synthetic");
  assert.deepEqual(found.call.evidence.map((item) => item.id), ["entity-snapshot"]);
  assert.equal(found.call.name, "loadEntitySnapshot");
  assert.equal(missing.status, "blocked");
  assert.equal(missing.snapshot, undefined);
  assert.deepEqual(missing.call.evidence.map((item) => item.id), ["entity-not-found"]);
  assert.equal(missing.call.status, "blocked");
});
