import assert from "node:assert/strict";
import test from "node:test";
import { getSyntheticEntity } from "../data/synthetic-entities";
import { compareHistoricalBaseline } from "./compare-historical-baseline";

test("computes the historical exposure delta", () => {
  const result = compareHistoricalBaseline(getSyntheticEntity("content_click_drop")!);

  assert.equal(result.exposureDelta, -0.4);
  assert.equal(result.call.status, "completed");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["exposure-vs-history"]);
  assert.equal(result.call.evidence[0].value, -0.4);
});

test("blocks a zero historical baseline without non-finite output", () => {
  const snapshot = {
    ...getSyntheticEntity("content_steady")!,
    historicalExposureMedian: 0,
  };
  const result = compareHistoricalBaseline(snapshot);

  assert.equal(result.call.status, "blocked");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["exposure-vs-history"]);
  assert.equal(Number.isFinite(result.exposureDelta), true);
});
