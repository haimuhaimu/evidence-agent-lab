import assert from "node:assert/strict";
import test from "node:test";
import { loadEntitySnapshot } from "./load-entity-snapshot";
import { compareHistoricalBaseline } from "./compare-historical-baseline";

function snapshot(entityId = "content_steady") {
  return loadEntitySnapshot({ entityId, days: 7 }).snapshot!;
}

test("computes the historical exposure delta", () => {
  const result = compareHistoricalBaseline(snapshot("content_click_drop"));

  assert.equal(result.exposureDelta, -0.4);
  assert.equal(result.call.status, "completed");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["exposure-vs-history"]);
  assert.equal(result.call.evidence[0].value, -0.4);
});

test("blocks a zero historical baseline without non-finite output", () => {
  const alteredSnapshot = {
    ...snapshot(),
    metrics: { ...snapshot().metrics!, historicalExposureMedian: 0 },
  };
  const result = compareHistoricalBaseline(alteredSnapshot);

  assert.equal(result.call.status, "blocked");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["exposure-vs-history"]);
  assert.equal(Number.isFinite(result.exposureDelta), true);
});

test("truthfully explains a non-finite current historical metric", () => {
  const alteredSnapshot = {
    ...snapshot(),
    metrics: { ...snapshot().metrics!, exposure: Number.NaN },
  };
  const result = compareHistoricalBaseline(alteredSnapshot);

  assert.equal(result.call.status, "blocked");
  assert.match(result.call.evidence[0].claim, /current exposure or historical median/);
  assert.match(result.call.reason, /current exposure and historical median/);
  assert.equal(Number.isFinite(result.exposureDelta), true);
});
