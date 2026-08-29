import assert from "node:assert/strict";
import test from "node:test";
import { loadEntitySnapshot } from "./load-entity-snapshot";

test("loads only declared synthetic objects", () => {
  const found = loadEntitySnapshot({ entityId: "content_steady", days: 7 });
  const missing = loadEntitySnapshot({ entityId: "real_123", days: 7 });

  assert.equal(found.status, "completed");
  assert.equal(found.snapshot?.source, "synthetic");
  assert.deepEqual(found.call.evidence.map((item) => item.id), ["entity-snapshot"]);
  assert.equal(found.call.name, "loadEntitySnapshot");
  assert.equal(missing.status, "blocked");
  assert.equal(missing.snapshot, undefined);
  assert.deepEqual(missing.call.evidence.map((item) => item.id), ["entity-not-found"]);
  assert.equal(missing.call.status, "blocked");
});

test("returns the exact requested synthetic window without an undated scalar fallback", () => {
  const sevenDays = loadEntitySnapshot({ entityId: "content_steady", days: 7 });
  const ninetyDays = loadEntitySnapshot({ entityId: "content_steady", days: 90 });
  const undeclared = loadEntitySnapshot({ entityId: "content_steady", days: 42 });

  assert.equal(sevenDays.snapshot?.requestedDays, 7);
  assert.equal(sevenDays.snapshot?.metrics?.days, 7);
  assert.equal(ninetyDays.snapshot?.requestedDays, 90);
  assert.equal(ninetyDays.snapshot?.metrics?.days, 90);
  assert.equal(undeclared.snapshot?.requestedDays, 42);
  assert.equal(undeclared.snapshot?.metrics, null);
  assert.equal(undeclared.status, "completed");
  assert.equal("exposure" in undeclared.snapshot!, false);
});

test("returns independent deep-frozen window snapshot copies", () => {
  const first = loadEntitySnapshot({ entityId: "content_steady", days: 7 });
  const fresh = loadEntitySnapshot({ entityId: "content_steady", days: 7 });

  assert.notStrictEqual(first.snapshot, fresh.snapshot);
  assert.notStrictEqual(first.snapshot?.metrics, fresh.snapshot?.metrics);
  assert.equal(Object.isFrozen(first.snapshot), true);
  assert.equal(Object.isFrozen(first.snapshot?.metrics), true);
  assert.throws(() => {
    (first.snapshot!.metrics as { exposure: number }).exposure = -1;
  });
  assert.ok((fresh.snapshot?.metrics?.exposure ?? -1) >= 0);
});
