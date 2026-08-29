import assert from "node:assert/strict";
import test from "node:test";
import { getSyntheticEntity } from "../data/synthetic-entities";
import { compareHistoricalBaseline } from "./compare-historical-baseline";
import { comparePeerBenchmark } from "./compare-peer-benchmark";

test("computes historical and peer deltas", () => {
  const snapshot = getSyntheticEntity("content_click_drop")!;
  const historical = compareHistoricalBaseline(snapshot);
  const peer = comparePeerBenchmark(snapshot);

  assert.equal(historical.exposureDelta < 0, true);
  assert.equal(peer.exposureDelta, -0.4);
  assert.ok(Math.abs(peer.clickRateDelta - -0.6) < Number.EPSILON);
  assert.equal(peer.completionRateDelta, 0);
  assert.equal(peer.call.status, "completed");
  assert.deepEqual(peer.call.evidence.map((item) => item.id), [
    "exposure-vs-peer",
    "click-rate-vs-peer",
    "completion-rate-vs-peer",
  ]);
});

test("blocks zero peer baselines without non-finite outputs", () => {
  const snapshot = {
    ...getSyntheticEntity("content_steady")!,
    peerExposureMedian: 0,
    peerClickRate: 0,
    peerCompletionRate: 0,
  };
  const result = comparePeerBenchmark(snapshot);

  assert.equal(result.call.status, "blocked");
  assert.deepEqual(result.call.evidence.map((item) => item.id), [
    "exposure-vs-peer",
    "click-rate-vs-peer",
    "completion-rate-vs-peer",
  ]);
  assert.equal(Number.isFinite(result.exposureDelta), true);
  assert.equal(Number.isFinite(result.clickRateDelta), true);
  assert.equal(Number.isFinite(result.completionRateDelta), true);
});

test("truthfully explains a non-finite current peer metric", () => {
  const snapshot = {
    ...getSyntheticEntity("content_steady")!,
    clickRate: Number.POSITIVE_INFINITY,
  };
  const result = comparePeerBenchmark(snapshot);
  const clickEvidence = result.call.evidence.find((item) => item.id === "click-rate-vs-peer")!;

  assert.equal(result.call.status, "blocked");
  assert.match(clickEvidence.claim, /current metric or peer median/);
  assert.match(result.call.reason, /current metrics and peer medians/);
  assert.equal(Number.isFinite(result.clickRateDelta), true);
});
