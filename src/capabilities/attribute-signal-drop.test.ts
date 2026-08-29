import assert from "node:assert/strict";
import test from "node:test";
import { getSyntheticEntity } from "../data/synthetic-entities";
import { attributeSignalDrop } from "./attribute-signal-drop";

test("attributes a click problem before checking distribution", () => {
  const result = attributeSignalDrop(getSyntheticEntity("content_click_drop")!);

  assert.equal(result.primarySignal, "click_rate");
  assert.equal(result.explainsExposureDrop, true);
  assert.equal(result.call.status, "completed");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["primary-signal"]);
  assert.equal(result.call.evidence[0].value, "click_rate");
});

test("chooses only the largest negative observed peer signal", () => {
  const snapshot = {
    ...getSyntheticEntity("content_click_drop")!,
    clickRate: 0.04,
    completionRate: 0.3,
  };

  const result = attributeSignalDrop(snapshot);

  assert.equal(result.primarySignal, "completion_rate");
  assert.equal(result.explainsExposureDrop, true);
});

test("leaves the primary signal unclassified when peer deltas are above the threshold", () => {
  const result = attributeSignalDrop(getSyntheticEntity("content_feed_drop")!);

  assert.equal(result.primarySignal, "none");
  assert.equal(result.explainsExposureDrop, false);
});

test("requires a historical exposure drop of at least twenty percent", () => {
  const atThreshold = {
    ...getSyntheticEntity("content_click_drop")!,
    exposure: 8000,
  };
  const aboveThreshold = { ...atThreshold, exposure: 8100 };

  assert.equal(attributeSignalDrop(atThreshold).explainsExposureDrop, true);
  assert.equal(attributeSignalDrop(aboveThreshold).explainsExposureDrop, false);
});
