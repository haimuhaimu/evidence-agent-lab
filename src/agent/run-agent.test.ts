import assert from "node:assert/strict";
import test from "node:test";
import { SYNTHETIC_ENTITIES } from "../data/synthetic-entities";
import { runEvidenceAgent } from "./run-agent";

const BOUNDARY_NOTES = [
  "Uses synthetic data only.",
  "Uses a deterministic planner, not free-form model reasoning.",
  "No production action was taken.",
  "No model training occurred.",
];

test("does not check distribution after a metric explains the drop", () => {
  const run = runEvidenceAgent({
    entityId: "content_click_drop",
    query: "近 7 天为什么掉了",
  });

  assert.equal(run.calls.some((call) => call.name === "checkDistributionPath"), false);
  assert.equal(run.decision, "intervene");
});

test("stops when evidence is incomplete", () => {
  const run = runEvidenceAgent({
    entityId: "content_incomplete",
    query: "近 7 天正常吗",
  });

  assert.equal(run.decision, "insufficient_evidence");
  assert.deepEqual(run.calls.map((call) => call.name), [
    "loadEntitySnapshot",
    "checkSafetyGate",
  ]);
});

test("stops before capabilities when the entity is missing from the request", () => {
  const run = runEvidenceAgent({ entityId: "  ", query: "近 7 天正常吗" });

  assert.equal(run.decision, "insufficient_evidence");
  assert.deepEqual(run.calls, []);
  assert.deepEqual(run.unknowns, ["Choose a synthetic content object."]);
});

test("stops after loading an unknown synthetic entity", () => {
  const run = runEvidenceAgent({ entityId: "unknown_object", query: "近 7 天正常吗" });

  assert.equal(run.decision, "insufficient_evidence");
  assert.deepEqual(run.calls.map((call) => call.name), ["loadEntitySnapshot"]);
  assert.deepEqual(run.evidence.map((item) => item.id), ["entity-not-found"]);
});

test("stops young content at the safety gate", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  const publishedHours = entity.publishedHours;
  entity.publishedHours = 1;

  try {
    const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });

    assert.equal(run.decision, "insufficient_evidence");
    assert.deepEqual(run.calls.map((call) => call.name), [
      "loadEntitySnapshot",
      "checkSafetyGate",
    ]);
    assert.deepEqual(run.calls[1].evidence.map((item) => item.id), ["publish-age"]);
  } finally {
    entity.publishedHours = publishedHours;
  }
});

test("stops a safety flag without building an escalation packet", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  const policyFlag = entity.policyFlag;
  entity.policyFlag = true;

  try {
    const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });

    assert.equal(run.decision, "insufficient_evidence");
    assert.deepEqual(run.calls.map((call) => call.name), [
      "loadEntitySnapshot",
      "checkSafetyGate",
    ]);
    assert.equal(run.calls.some((call) => call.name === "buildEscalationPacket"), false);
  } finally {
    entity.policyFlag = policyFlag;
  }
});

test("orders metric-attributed evidence without conditional calls", () => {
  const run = runEvidenceAgent({
    entityId: "content_click_drop",
    query: "近 7 天为什么掉了",
  });

  assert.equal(run.decision, "intervene");
  assert.deepEqual(run.calls.map((call) => call.name), [
    "loadEntitySnapshot",
    "checkSafetyGate",
    "compareHistoricalBaseline",
    "comparePeerBenchmark",
    "attributeSignalDrop",
  ]);
  assert.deepEqual(run.evidence.map((item) => item.id), [
    "entity-snapshot",
    "data-completeness",
    "publish-age",
    "policy-flag",
    "exposure-vs-history",
    "exposure-vs-peer",
    "click-rate-vs-peer",
    "completion-rate-vs-peer",
    "primary-signal",
  ]);
});

test("checks unexplained Feed-share risk and builds one local packet", () => {
  const run = runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  });

  assert.equal(run.decision, "intervene");
  assert.deepEqual(run.calls.map((call) => call.name), [
    "loadEntitySnapshot",
    "checkSafetyGate",
    "compareHistoricalBaseline",
    "comparePeerBenchmark",
    "attributeSignalDrop",
    "checkDistributionPath",
    "buildEscalationPacket",
  ]);
  assert.deepEqual(run.evidence.map((item) => item.id), [
    "entity-snapshot",
    "data-completeness",
    "publish-age",
    "policy-flag",
    "exposure-vs-history",
    "exposure-vs-peer",
    "click-rate-vs-peer",
    "completion-rate-vs-peer",
    "primary-signal",
    "feed-share-vs-history",
    "escalation-packet",
  ]);
  assert.equal(run.evidence.at(-1)?.value, "not_sent");
});

test("scales healthy evidence only with scale intent", () => {
  const scaleRun = runEvidenceAgent({
    entityId: "content_scale",
    query: "近 7 天值得追投吗",
  });
  const diagnosisRun = runEvidenceAgent({
    entityId: "content_scale",
    query: "近 7 天正常吗",
  });

  assert.equal(scaleRun.decision, "scale");
  assert.equal(diagnosisRun.decision, "expected");
  assert.deepEqual(scaleRun.calls.map((call) => call.name), [
    "loadEntitySnapshot",
    "checkSafetyGate",
    "compareHistoricalBaseline",
    "comparePeerBenchmark",
    "attributeSignalDrop",
  ]);
  assert.equal(scaleRun.calls.some((call) => call.name === "checkDistributionPath"), false);
});

test("stops after a blocked historical comparison", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  const historicalExposureMedian = entity.historicalExposureMedian;
  entity.historicalExposureMedian = 0;

  try {
    const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });

    assert.equal(run.decision, "insufficient_evidence");
    assert.deepEqual(run.calls.map((call) => call.name), [
      "loadEntitySnapshot",
      "checkSafetyGate",
      "compareHistoricalBaseline",
    ]);
  } finally {
    entity.historicalExposureMedian = historicalExposureMedian;
  }
});

test("stops after a blocked peer comparison", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  const peerClickRate = entity.peerClickRate;
  entity.peerClickRate = 0;

  try {
    const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });

    assert.equal(run.decision, "insufficient_evidence");
    assert.deepEqual(run.calls.map((call) => call.name), [
      "loadEntitySnapshot",
      "checkSafetyGate",
      "compareHistoricalBaseline",
      "comparePeerBenchmark",
    ]);
  } finally {
    entity.peerClickRate = peerClickRate;
  }
});

test("includes the exact boundary notes on every exit path", () => {
  const runs = [
    runEvidenceAgent({ entityId: "", query: "近 7 天正常吗" }),
    runEvidenceAgent({ entityId: "unknown_object", query: "近 7 天正常吗" }),
    runEvidenceAgent({ entityId: "content_incomplete", query: "近 7 天正常吗" }),
    runEvidenceAgent({ entityId: "content_steady", query: "近 7 天正常吗" }),
  ];

  for (const run of runs) {
    assert.deepEqual(run.boundaryNotes, BOUNDARY_NOTES);
  }
});
