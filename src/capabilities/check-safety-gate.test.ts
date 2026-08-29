import assert from "node:assert/strict";
import test from "node:test";
import { getSyntheticEntity } from "../data/synthetic-entities";
import { checkSafetyGate } from "./check-safety-gate";

const steady = getSyntheticEntity("content_steady")!;

test("blocks low-completeness evidence", () => {
  const result = checkSafetyGate(getSyntheticEntity("content_incomplete")!);

  assert.equal(result.status, "blocked");
  assert.equal(result.evidence[0].id, "data-completeness");
  assert.equal(result.evidence[0].value, 0.5);
  assert.equal(result.name, "checkSafetyGate");
});

test("blocks content published less than two hours ago", () => {
  const result = checkSafetyGate({ ...steady, publishedHours: 1.99 });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.evidence.map((item) => item.id), ["publish-age"]);
});

test("blocks policy-flagged content", () => {
  const result = checkSafetyGate({ ...steady, policyFlag: true });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.evidence.map((item) => item.id), ["policy-flag"]);
});

test("allows evidence at the public safety thresholds", () => {
  const result = checkSafetyGate({
    ...steady,
    dataCompleteness: 0.75,
    publishedHours: 2,
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(result.evidence.map((item) => item.id), [
    "data-completeness",
    "publish-age",
    "policy-flag",
  ]);
});
