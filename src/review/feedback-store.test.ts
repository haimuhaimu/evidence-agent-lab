import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import type { AgentRun } from "../core/types";
import {
  buildRunId,
  createReview,
  parseReviewRecords,
  saveReview,
  type StorageLike,
} from "./feedback-store";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  firstValue() {
    return this.values.values().next().value ?? "[]";
  }
}

const CLICK_DROP_RUN = runEvidenceAgent({
  entityId: "content_click_drop",
  query: "diagnose the last 7 days",
});

function reviewInput(run: AgentRun = CLICK_DROP_RUN) {
  return {
    run,
    verdict: "needs_correction" as const,
    correctedDecision: "expected" as const,
    note: "The synthetic evidence does not support intervention.",
    groupFeedback: "same_issue" as const,
    createdAt: "2026-08-29T09:00:00.000Z",
  };
}

test("rejects corrupt or semantically empty review records", () => {
  assert.deepEqual(parseReviewRecords("not-json"), []);
  assert.deepEqual(parseReviewRecords(JSON.stringify([{ id: "x" }])), []);
  assert.deepEqual(parseReviewRecords(JSON.stringify([{
    id: "x",
    runId: "run-1",
    entityId: "content_click_drop",
    originalDecision: "intervene",
    verdict: "needs_correction",
    correctedDecision: "expected",
    note: " ",
    fingerprint: "intervene:primary-signal",
    groupFeedback: "same_issue",
    createdAt: "2026-08-29T09:00:00.000Z",
  }])), []);
});

test("a correction requires a different target decision", () => {
  assert.throws(() => createReview({
    ...reviewInput(),
    correctedDecision: "intervene",
  }));
});

test("builds a run id from the reviewed run's request and decision", () => {
  assert.equal(buildRunId(CLICK_DROP_RUN), "content_click_drop:7:diagnose:intervene");
});

test("creates a stable replacement id without changing the reviewed run", () => {
  const before = structuredClone(CLICK_DROP_RUN);
  const record = createReview(reviewInput());

  assert.deepEqual(CLICK_DROP_RUN, before);
  assert.deepEqual(record, {
    id: "content_click_drop:7:diagnose:intervene:needs_correction:expected",
    runId: "content_click_drop:7:diagnose:intervene",
    entityId: "content_click_drop",
    originalDecision: "intervene",
    verdict: "needs_correction",
    correctedDecision: "expected",
    note: "The synthetic evidence does not support intervention.",
    fingerprint: "intervene:primary-signal",
    groupFeedback: "same_issue",
    createdAt: "2026-08-29T09:00:00.000Z",
  });
});

test("replaces duplicate ids and retains the newest fifty local records", () => {
  const storage = new MemoryStorage();
  const base = createReview(reviewInput());

  for (let index = 0; index <= 50; index += 1) {
    saveReview(storage, {
      ...base,
      id: `review-${index}`,
      createdAt: `2026-08-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  saveReview(storage, {
    ...base,
    id: "review-50",
    note: "The most recent review replaces its prior version.",
    createdAt: "2026-10-01T09:00:00.000Z",
  });

  const records = parseReviewRecords(storage.firstValue());
  assert.equal(records.length, 50);
  assert.equal(records.some((record) => record.id === "review-0"), false);
  assert.deepEqual(records.find((record) => record.id === "review-50"), {
    ...base,
    id: "review-50",
    note: "The most recent review replaces its prior version.",
    createdAt: "2026-10-01T09:00:00.000Z",
  });
});
