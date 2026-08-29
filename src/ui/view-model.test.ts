import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import { buildAgentViewModel, isReviewCurrent } from "./view-model";

test("keeps the first screen to one decision and at most three evidence items", () => {
  const run = runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  });
  const view = buildAgentViewModel(run);

  assert.equal(view.decision, "intervene");
  assert.ok(view.primaryEvidence.length <= 3);
  assert.deepEqual(view.primaryEvidence.map((item) => item.id), [
    "feed-share-vs-history",
    "exposure-vs-history",
    "exposure-vs-peer",
  ]);
  assert.equal(view.traceCount, run.calls.length);
  assert.match(view.disclosure, /deterministic planner/i);
  assert.deepEqual(view.reviewedRequest, {
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  });
});

test("selects the primary observed signal and its supporting baselines", () => {
  const view = buildAgentViewModel(runEvidenceAgent({
    entityId: "content_click_drop",
    query: "近 7 天为什么掉了",
  }));

  assert.deepEqual(view.primaryEvidence.map((item) => item.id), [
    "primary-signal",
    "exposure-vs-history",
    "click-rate-vs-peer",
  ]);
});

test("projects runner-owned relevance without recomputing evidence thresholds", () => {
  const run = runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  });
  const changedEvidence = run.evidence.map((item) => item.id === "feed-share-vs-history"
    ? { ...item, value: -0.01 }
    : item);
  const view = buildAgentViewModel({ ...run, evidence: changedEvidence });

  assert.deepEqual(view.primaryEvidence.map((item) => item.id), [
    "feed-share-vs-history",
    "exposure-vs-history",
    "exposure-vs-peer",
  ]);
});

test("puts blocking evidence first and preserves concrete unknowns", () => {
  const incomplete = buildAgentViewModel(runEvidenceAgent({
    entityId: "content_incomplete",
    query: "近 7 天正常吗",
  }));
  const invalidWindow = buildAgentViewModel(runEvidenceAgent({
    entityId: "content_steady",
    query: "近 1.5 天正常吗",
  }));

  assert.equal(incomplete.primaryEvidence[0]?.id, "data-completeness");
  assert.match(incomplete.unknowns.join(" "), /completeness is below/i);
  assert.deepEqual(invalidWindow.primaryEvidence, []);
  assert.deepEqual(invalidWindow.unknowns, [
    "Use a whole-number time window between 1 and 180 days.",
  ]);
});

test("marks review controls stale whenever either form field differs from the reviewed run", () => {
  const run = runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  });

  assert.equal(isReviewCurrent(run, {
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  }), true);
  assert.equal(isReviewCurrent(run, {
    entityId: "content_steady",
    query: "近 7 天为什么掉了",
  }), false);
  assert.equal(isReviewCurrent(run, {
    entityId: "content_feed_drop",
    query: "近 30 天为什么掉了",
  }), false);
  assert.equal(isReviewCurrent(run, {
    entityId: "  content_feed_drop  ",
    query: "  近 7 天为什么掉了  ",
  }), true);
});
