import assert from "node:assert/strict";
import test from "node:test";
import type { HistoricalComparison, PeerComparison } from "./types";
import { attributeSignalDrop } from "./attribute-signal-drop";

function comparisons(input: {
  exposureDelta: number;
  clickRateDelta: number;
  completionRateDelta: number;
}) {
  const historical: HistoricalComparison = {
    exposureDelta: input.exposureDelta,
    call: {
      name: "compareHistoricalBaseline",
      status: "completed",
      evidence: [],
      reason: "Recorded historical comparison.",
    },
  };
  const peer: PeerComparison = {
    exposureDelta: input.exposureDelta,
    clickRateDelta: input.clickRateDelta,
    completionRateDelta: input.completionRateDelta,
    call: {
      name: "comparePeerBenchmark",
      status: "completed",
      evidence: [],
      reason: "Recorded peer comparison.",
    },
  };

  return { historical, peer };
}

test("attributes a click problem before checking distribution", () => {
  const result = attributeSignalDrop(comparisons({
    exposureDelta: -0.4,
    clickRateDelta: -0.6,
    completionRateDelta: 0,
  }));

  assert.equal(result.primarySignal, "click_rate");
  assert.equal(result.explainsExposureDrop, true);
  assert.equal(result.call.status, "completed");
  assert.deepEqual(result.call.evidence.map((item) => item.id), ["primary-signal"]);
  assert.equal(result.call.evidence[0].value, "click_rate");
});

test("chooses only the largest negative observed peer signal", () => {
  const result = attributeSignalDrop(comparisons({
    exposureDelta: -0.4,
    clickRateDelta: -0.2,
    completionRateDelta: -0.5,
  }));

  assert.equal(result.primarySignal, "completion_rate");
  assert.equal(result.explainsExposureDrop, true);
});

test("leaves the primary signal unclassified when peer deltas are above the threshold", () => {
  const result = attributeSignalDrop(comparisons({
    exposureDelta: -0.3,
    clickRateDelta: 0,
    completionRateDelta: 0,
  }));

  assert.equal(result.primarySignal, "none");
  assert.equal(result.explainsExposureDrop, false);
});

test("requires a historical exposure drop of at least twenty percent", () => {
  assert.equal(attributeSignalDrop(comparisons({
    exposureDelta: -0.2,
    clickRateDelta: -0.6,
    completionRateDelta: 0,
  })).explainsExposureDrop, true);
  assert.equal(attributeSignalDrop(comparisons({
    exposureDelta: -0.19,
    clickRateDelta: -0.6,
    completionRateDelta: 0,
  })).explainsExposureDrop, false);
});

test("uses the runner-recorded comparison statuses instead of rerunning capabilities", () => {
  const input = comparisons({
    exposureDelta: -0.4,
    clickRateDelta: -0.6,
    completionRateDelta: 0,
  });
  input.peer.call.status = "blocked";

  const result = attributeSignalDrop(input);

  assert.equal(result.call.status, "blocked");
  assert.equal(result.primarySignal, "none");
  assert.equal(result.explainsExposureDrop, false);
});
