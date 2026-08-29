import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import { createReview } from "./feedback-store";
import { groupConfirmedIssues } from "./issue-groups";

const confirmedA = createReview({
  run: runEvidenceAgent({
    entityId: "content_click_drop",
    query: "diagnose the last 7 days",
  }),
  verdict: "needs_correction",
  correctedDecision: "expected",
  note: "This is a confirmed decision error.",
  groupFeedback: "same_issue",
  createdAt: "2026-08-29T09:00:00.000Z",
});

const confirmedB = createReview({
  run: runEvidenceAgent({
    entityId: "content_retention_drop",
    query: "diagnose the last 7 days",
  }),
  verdict: "needs_correction",
  correctedDecision: "expected",
  note: "This is a second confirmed decision error.",
  groupFeedback: "same_issue",
  createdAt: "2026-08-29T10:00:00.000Z",
});

const rejectedC = createReview({
  run: runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "diagnose the last 7 days",
  }),
  verdict: "needs_correction",
  correctedDecision: "expected",
  note: "This has not been confirmed as the same issue.",
  groupFeedback: "different_issue",
  createdAt: "2026-08-29T11:00:00.000Z",
});

test("groups only human-confirmed matching fingerprints", () => {
  const groups = groupConfirmedIssues([confirmedA, confirmedB, rejectedC]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].recordIds, [confirmedA.id, confirmedB.id]);
});

test("requires two distinct confirmed record ids before grouping", () => {
  assert.deepEqual(groupConfirmedIssues([confirmedA, confirmedA]), []);
  assert.deepEqual(groupConfirmedIssues([confirmedA, confirmedB]), [{
    fingerprint: confirmedA.fingerprint,
    recordIds: [confirmedA.id, confirmedB.id],
  }]);
});

test("does not treat accurate reviews as issue confirmations", () => {
  const accurate = createReview({
    run: runEvidenceAgent({
      entityId: "content_feed_drop",
      query: "diagnose the last 7 days",
    }),
    verdict: "accurate",
    note: "The decision is accurate.",
    groupFeedback: "same_issue",
    createdAt: "2026-08-29T12:00:00.000Z",
  });

  assert.deepEqual(groupConfirmedIssues([confirmedA, accurate]), []);
});
