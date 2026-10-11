import assert from "node:assert/strict";
import test from "node:test";
import { BENCHMARK_CASES, DEFAULT_BOUNDARY } from "./cases";

const EXPECTED_CASES = [
  ["steady_7d", "content_steady", "diagnose", 7, "expected"],
  ["steady_quarter", "content_steady", "diagnose", 90, "expected"],
  ["steady_half_month", "content_steady", "diagnose", 15, "expected"],
  ["scale_healthy", "content_scale", "scale", 7, "scale"],
  ["scale_without_intent", "content_scale", "diagnose", 7, "expected"],
  ["click_drop", "content_click_drop", "diagnose", 7, "intervene"],
  ["retention_drop", "content_retention_drop", "diagnose", 7, "intervene"],
  ["feed_drop", "content_feed_drop", "diagnose", 7, "intervene"],
  ["incomplete_data", "content_incomplete", "diagnose", 7, "insufficient_evidence"],
  ["unknown_object", "content_missing", "diagnose", 7, "insufficient_evidence"],
  ["missing_object", "", "diagnose", 7, "insufficient_evidence"],
  ["explicit_30d", "content_steady", "diagnose", 30, "expected"],
  ["scale_click_drop", "content_click_drop", "scale", 7, "intervene"],
  ["scale_incomplete", "content_incomplete", "scale", 7, "insufficient_evidence"],
  ["feed_drop_quarter", "content_feed_drop", "diagnose", 90, "intervene"],
  ["click_drop_quarter", "content_click_drop", "diagnose", 90, "intervene"],
  ["healthy_no_window", "content_steady", "diagnose", 7, "expected"],
  ["healthy_scale_30d", "content_scale", "scale", 30, "scale"],
  ["conflicting_windows", "content_steady", "diagnose", 7, "insufficient_evidence"],
  ["invalid_second_window", "content_steady", "diagnose", 7, "insufficient_evidence"],
] as const;

test("ships exactly the twenty fixed request and decision contracts", () => {
  assert.equal(BENCHMARK_CASES.length, 20);
  assert.equal(new Set(BENCHMARK_CASES.map((item) => item.id)).size, 20);
  assert.deepEqual(
    BENCHMARK_CASES.map((item) => [
      item.id,
      item.expectedRequest.entityId,
      item.expectedRequest.goal,
      item.expectedRequest.days,
      item.expectedDecision,
    ]),
    EXPECTED_CASES,
  );
});

test("every case locks clarification, exact call status, evidence ownership, and boundary", () => {
  for (const item of BENCHMARK_CASES) {
    const { expectedPrimaryEvidenceIds } = item;
    assert.equal(item.expectedRequest.query, item.request.query, item.id);
    assert.ok(Array.isArray(item.expectedRequest.clarificationNeeded), item.id);
    assert.ok(Array.isArray(item.expectedCalls), item.id);
    assert.ok(Array.isArray(item.expectedEvidence), item.id);
    assert.equal(
      new Set(item.expectedCalls.map((call) => call.name)).size,
      item.expectedCalls.length,
      item.id,
    );
    assert.equal(
      new Set(item.expectedEvidence.map((evidence) => evidence.id)).size,
      item.expectedEvidence.length,
      item.id,
    );
    assert.ok(Array.isArray(expectedPrimaryEvidenceIds), item.id);
    assert.ok(expectedPrimaryEvidenceIds.length <= 3, item.id);
    assert.equal(
      new Set(expectedPrimaryEvidenceIds).size,
      expectedPrimaryEvidenceIds.length,
      item.id,
    );
    assert.ok(
      expectedPrimaryEvidenceIds.every((id) => (
        item.expectedEvidence.some((evidence) => evidence.id === id)
      )),
      item.id,
    );
    assert.deepEqual(item.expectedBoundary, {
      ...DEFAULT_BOUNDARY,
      delivery: item.expectedCalls.some((call) => call.name === "buildEscalationPacket")
        ? "not_sent"
        : "none",
    }, item.id);
  }
});

test("locks honest early-stop contracts without invented downstream evidence", () => {
  const byId = new Map(BENCHMARK_CASES.map((item) => [item.id, item]));

  assert.deepEqual(byId.get("missing_object")?.expectedCalls, []);
  assert.deepEqual(byId.get("missing_object")?.expectedEvidence, []);
  assert.deepEqual(
    byId.get("missing_object")?.expectedPrimaryEvidenceIds,
    [],
  );
  assert.deepEqual(byId.get("missing_object")?.expectedRequest.clarificationNeeded, [
    "Choose a synthetic content object.",
  ]);
  assert.deepEqual(byId.get("unknown_object")?.expectedCalls, [
    { name: "loadEntitySnapshot", status: "blocked" },
  ]);
  assert.deepEqual(byId.get("unknown_object")?.expectedEvidence, [
    {
      id: "entity-not-found",
      capability: "loadEntitySnapshot",
      value: "content_missing",
    },
  ]);
  assert.deepEqual(byId.get("incomplete_data")?.expectedCalls, [
    { name: "loadEntitySnapshot", status: "completed" },
    { name: "checkSafetyGate", status: "blocked" },
  ]);
  assert.equal(
    byId.get("incomplete_data")?.expectedEvidence.find((item) => item.id === "data-completeness")?.value,
    0.5,
  );
  assert.deepEqual(
    byId.get("incomplete_data")?.expectedPrimaryEvidenceIds,
    ["data-completeness"],
  );
});
