import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityName } from "../core/types";
import { BENCHMARK_CASES, DEFAULT_HONESTY_CHECKS } from "./cases";

const ALL_CAPABILITIES: CapabilityName[] = [
  "loadEntitySnapshot",
  "checkSafetyGate",
  "compareHistoricalBaseline",
  "comparePeerBenchmark",
  "attributeSignalDrop",
  "checkDistributionPath",
  "buildEscalationPacket",
];

const BASE_CAPABILITIES = ALL_CAPABILITIES.slice(0, 5);
const BASE_EVIDENCE = [
  "entity-snapshot",
  "data-completeness",
  "publish-age",
  "exposure-vs-history",
  "click-rate-vs-peer",
  "completion-rate-vs-peer",
  "primary-signal",
];

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
] as const;

test("ships exactly eighteen unique benchmark cases", () => {
  assert.equal(BENCHMARK_CASES.length, 18);
  assert.equal(new Set(BENCHMARK_CASES.map((item) => item.id)).size, 18);
  assert.deepEqual(
    BENCHMARK_CASES.map((item) => [
      item.id,
      item.request.entityId,
      item.expectedIntent.goal,
      item.expectedIntent.days,
      item.expectedDecision,
    ]),
    EXPECTED_CASES,
  );
});

test("every case declares all five audit gates", () => {
  for (const item of BENCHMARK_CASES) {
    assert.ok(item.expectedIntent);
    assert.ok(Array.isArray(item.requiredCapabilities));
    assert.ok(Array.isArray(item.forbiddenCapabilities));
    assert.ok(item.requiredEvidence.length > 0 || item.expectedDecision === "insufficient_evidence");
    assert.ok(item.honestyChecks.length > 0);
    assert.deepEqual(item.honestyChecks, DEFAULT_HONESTY_CHECKS);
  }
});

test("locks capability and evidence contracts for every case family", () => {
  const byId = new Map(BENCHMARK_CASES.map((item) => [item.id, item]));
  const baseIds = [
    "steady_7d",
    "steady_quarter",
    "steady_half_month",
    "scale_healthy",
    "scale_without_intent",
    "click_drop",
    "retention_drop",
    "explicit_30d",
    "scale_click_drop",
    "click_drop_quarter",
    "healthy_no_window",
    "healthy_scale_30d",
  ];

  for (const id of baseIds) {
    assert.deepEqual(byId.get(id)?.requiredCapabilities, BASE_CAPABILITIES, id);
    assert.deepEqual(byId.get(id)?.forbiddenCapabilities, ALL_CAPABILITIES.slice(5), id);
    assert.deepEqual(byId.get(id)?.requiredEvidence, BASE_EVIDENCE, id);
  }

  for (const id of ["feed_drop", "feed_drop_quarter"]) {
    assert.deepEqual(byId.get(id)?.requiredCapabilities, ALL_CAPABILITIES, id);
    assert.deepEqual(byId.get(id)?.forbiddenCapabilities, [], id);
    assert.deepEqual(
      byId.get(id)?.requiredEvidence,
      [...BASE_EVIDENCE, "feed-share-vs-history", "escalation-packet"],
      id,
    );
  }

  for (const id of ["incomplete_data", "scale_incomplete"]) {
    assert.deepEqual(byId.get(id)?.requiredCapabilities, ALL_CAPABILITIES.slice(0, 2), id);
    assert.deepEqual(byId.get(id)?.forbiddenCapabilities, ALL_CAPABILITIES.slice(2), id);
    assert.deepEqual(byId.get(id)?.requiredEvidence, ["entity-snapshot", "data-completeness"], id);
  }

  assert.deepEqual(byId.get("unknown_object")?.requiredCapabilities, ALL_CAPABILITIES.slice(0, 1));
  assert.deepEqual(byId.get("unknown_object")?.forbiddenCapabilities, ALL_CAPABILITIES.slice(1));
  assert.deepEqual(byId.get("unknown_object")?.requiredEvidence, ["entity-not-found"]);

  assert.deepEqual(byId.get("missing_object")?.requiredCapabilities, []);
  assert.deepEqual(byId.get("missing_object")?.forbiddenCapabilities, ALL_CAPABILITIES);
  assert.deepEqual(byId.get("missing_object")?.requiredEvidence, []);
});
