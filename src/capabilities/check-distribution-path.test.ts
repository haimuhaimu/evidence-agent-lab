import assert from "node:assert/strict";
import test from "node:test";
import { loadEntitySnapshot } from "./load-entity-snapshot";
import { checkDistributionPath } from "./check-distribution-path";

function snapshot(entityId = "content_steady") {
  return loadEntitySnapshot({ entityId, days: 7 }).snapshot!;
}

test("checks distribution only when observed metrics do not explain the drop", () => {
  const result = checkDistributionPath(snapshot("content_feed_drop"), {
    primarySignal: "none",
    explainsExposureDrop: false,
  });

  assert.equal(result.status, "risk");
  assert.ok(Math.abs(result.feedShareDelta - -2 / 3) < Number.EPSILON);
  assert.equal(result.call.status, "completed");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["feed-share-vs-history"]);
});

test("skips the synthetic distribution comparison after observed attribution", () => {
  const result = checkDistributionPath(snapshot("content_click_drop"), {
    primarySignal: "click_rate",
    explainsExposureDrop: true,
  });

  assert.equal(result.status, "not_needed");
  assert.equal(result.feedShareDelta, 0);
  assert.equal(result.call.status, "skipped");
  assert.match(result.call.reason, /not needed/i);
});

test("watches a distribution path without a twenty percent feed-share drop", () => {
  const result = checkDistributionPath(snapshot(), {
    primarySignal: "none",
    explainsExposureDrop: false,
  });

  assert.equal(result.status, "watch");
  assert.equal(result.feedShareDelta, 0);
  assert.equal(result.call.status, "completed");
});

test("treats a twenty percent synthetic feed-share drop as risk", () => {
  const alteredSnapshot = {
    ...snapshot(),
    metrics: { ...snapshot().metrics!, feedShare: 0.24 },
  };

  const result = checkDistributionPath(alteredSnapshot, {
    primarySignal: "none",
    explainsExposureDrop: false,
  });

  assert.equal(result.status, "risk");
});
