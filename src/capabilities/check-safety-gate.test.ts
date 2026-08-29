import assert from "node:assert/strict";
import test from "node:test";
import { loadEntitySnapshot } from "./load-entity-snapshot";
import { checkSafetyGate } from "./check-safety-gate";

function snapshot(entityId = "content_steady", days = 7) {
  return loadEntitySnapshot({ entityId, days }).snapshot!;
}

test("blocks low-completeness evidence", () => {
  const result = checkSafetyGate(snapshot("content_incomplete"));

  assert.equal(result.status, "blocked");
  const completeness = result.evidence.find((item) => item.id === "data-completeness");
  assert.equal(completeness?.value, 0.5);
  assert.equal(result.name, "checkSafetyGate");
});

test("blocks content whose publication age cannot cover the requested window", () => {
  const result = checkSafetyGate({ ...snapshot(), publishedHours: (7 * 24) - 1 });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.evidence.map((item) => item.id), [
    "window-coverage",
    "data-completeness",
    "publish-age",
    "policy-flag",
  ]);
  assert.equal(result.evidence[0].value, false);
});

test("blocks policy-flagged content", () => {
  const result = checkSafetyGate({ ...snapshot(), policyFlag: true });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.evidence.map((item) => item.id), [
    "window-coverage",
    "data-completeness",
    "publish-age",
    "policy-flag",
  ]);
});

test("allows evidence at the public safety thresholds", () => {
  const result = checkSafetyGate({
    ...snapshot(),
    metrics: { ...snapshot().metrics!, dataCompleteness: 0.75 },
    publishedHours: 7 * 24,
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(result.evidence.map((item) => item.id), [
    "window-coverage",
    "data-completeness",
    "publish-age",
    "policy-flag",
  ]);
});

test("requires exact coverage for each declared and arbitrary window", () => {
  for (const days of [7, 15, 30, 90]) {
    const result = checkSafetyGate(snapshot("content_steady", days));

    assert.equal(result.status, "completed", `${days} days`);
    assert.deepEqual(result.evidence[0], {
      id: "window-coverage",
      capability: "checkSafetyGate",
      claim: `An exact ${days}-day synthetic metric window is available and covered by publication age.`,
      value: true,
      source: "synthetic",
      confidence: "high",
    });
  }

  const missing = checkSafetyGate(snapshot("content_steady", 42));
  assert.equal(missing.status, "blocked");
  assert.deepEqual(missing.evidence.map((item) => item.id), ["window-coverage"]);
  assert.equal(missing.evidence[0].value, false);
  assert.match(missing.reason, /exact 42-day synthetic metric window is unavailable/i);
});
