import assert from "node:assert/strict";
import test from "node:test";
import { getSyntheticEntity } from "../data/synthetic-entities";
import { checkDistributionPath } from "./check-distribution-path";

test("checks distribution only when observed metrics do not explain the drop", () => {
  const snapshot = getSyntheticEntity("content_feed_drop")!;
  const result = checkDistributionPath(snapshot, {
    primarySignal: "none",
    explainsExposureDrop: false,
  });

  assert.equal(result.status, "risk");
  assert.ok(Math.abs(result.feedShareDelta - -2 / 3) < Number.EPSILON);
  assert.equal(result.call.status, "completed");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["feed-share-vs-history"]);
});

test("skips the synthetic distribution comparison after observed attribution", () => {
  const result = checkDistributionPath(getSyntheticEntity("content_click_drop")!, {
    primarySignal: "click_rate",
    explainsExposureDrop: true,
  });

  assert.equal(result.status, "not_needed");
  assert.equal(result.feedShareDelta, 0);
  assert.equal(result.call.status, "skipped");
  assert.match(result.call.reason, /not needed/i);
});

test("watches a distribution path without a twenty percent feed-share drop", () => {
  const result = checkDistributionPath(getSyntheticEntity("content_steady")!, {
    primarySignal: "none",
    explainsExposureDrop: false,
  });

  assert.equal(result.status, "watch");
  assert.equal(result.feedShareDelta, 0);
  assert.equal(result.call.status, "completed");
});

test("treats a twenty percent synthetic feed-share drop as risk", () => {
  const snapshot = {
    ...getSyntheticEntity("content_steady")!,
    feedShare: 0.24,
  };

  const result = checkDistributionPath(snapshot, {
    primarySignal: "none",
    explainsExposureDrop: false,
  });

  assert.equal(result.status, "risk");
});
