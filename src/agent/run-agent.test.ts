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

test("runs only exact declared windows and honestly stops an arbitrary window", () => {
  for (const days of [7, 15, 30, 90]) {
    const run = runEvidenceAgent({
      entityId: "content_steady",
      query: `近 ${days} 天正常吗`,
    });

    assert.equal(run.decision, "expected", `${days} days`);
    assert.equal(run.request.days, days);
    assert.equal(run.evidence.find((item) => item.id === "window-coverage")?.value, true);
  }

  const unsupported = runEvidenceAgent({
    entityId: "content_steady",
    query: "近 42 天正常吗",
  });
  assert.equal(unsupported.decision, "insufficient_evidence");
  assert.deepEqual(unsupported.calls.map((call) => call.name), [
    "loadEntitySnapshot",
    "checkSafetyGate",
  ]);
  assert.equal(unsupported.evidence.find((item) => item.id === "window-coverage")?.value, false);
  assert.match(unsupported.unknowns.join(" "), /exact 42-day synthetic metric window is unavailable/i);
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

test("cannot mutate a declared fixture to bypass publication-age evidence", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  assert.throws(() => {
    (entity as { publishedHours: number }).publishedHours = 1;
  });

  const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });
  assert.equal(run.decision, "expected");
  assert.equal(run.evidence.find((item) => item.id === "window-coverage")?.value, true);
});

test("cannot mutate a declared fixture to fabricate a policy flag", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  assert.throws(() => {
    (entity as { policyFlag: boolean }).policyFlag = true;
  });

  const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });
  assert.equal(run.decision, "expected");
  assert.equal(run.calls.some((call) => call.name === "buildEscalationPacket"), false);
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
    "window-coverage",
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
    "window-coverage",
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

test("cannot mutate a declared historical baseline", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  assert.throws(() => {
    (entity.windows[0] as { historicalExposureMedian: number }).historicalExposureMedian = 0;
  });

  const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });
  assert.equal(run.decision, "expected");
  assert.equal(run.calls.some((call) => call.name === "compareHistoricalBaseline"), true);
});

test("cannot mutate a declared peer baseline", () => {
  const entity = SYNTHETIC_ENTITIES.find((item) => item.id === "content_steady")!;
  assert.throws(() => {
    (entity.windows[0] as { peerClickRate: number }).peerClickRate = 0;
  });

  const run = runEvidenceAgent({ entityId: entity.id, query: "近 7 天正常吗" });
  assert.equal(run.decision, "expected");
  assert.equal(run.calls.some((call) => call.name === "comparePeerBenchmark"), true);
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
    assert.deepEqual(run.boundary, {
      scope: "synthetic_only",
      planner: "deterministic",
      action: "none",
      training: "none",
      delivery: run.calls.some((call) => call.name === "buildEscalationPacket")
        ? "not_sent"
        : "none",
      causal: "not_claimed",
    });
  }
});

test("records at most three call-owned primary evidence ids on every exit path", () => {
  const cases = [
    {
      request: { entityId: "content_steady", query: "近 7 天正常吗" },
      expected: ["exposure-vs-history", "click-rate-vs-peer", "completion-rate-vs-peer"],
    },
    {
      request: { entityId: "content_click_drop", query: "近 7 天为什么掉了" },
      expected: ["primary-signal", "exposure-vs-history", "click-rate-vs-peer"],
    },
    {
      request: { entityId: "content_retention_drop", query: "近 7 天为什么掉了" },
      expected: ["primary-signal", "exposure-vs-history", "completion-rate-vs-peer"],
    },
    {
      request: { entityId: "content_feed_drop", query: "近 7 天为什么掉了" },
      expected: ["feed-share-vs-history", "exposure-vs-history", "exposure-vs-peer"],
    },
    {
      request: { entityId: "content_incomplete", query: "近 7 天正常吗" },
      expected: ["data-completeness"],
    },
    {
      request: { entityId: "content_missing", query: "近 7 天正常吗" },
      expected: ["entity-not-found"],
    },
    {
      request: { entityId: "content_steady", query: "近 42 天正常吗" },
      expected: ["window-coverage"],
    },
    {
      request: { entityId: "", query: "近 7 天正常吗" },
      expected: [],
    },
  ] as const;

  for (const { request, expected } of cases) {
    const run = runEvidenceAgent(request);
    const { primaryEvidenceIds } = run;
    const callOwnedIds = new Set(
      run.calls.flatMap((call) => call.evidence.map((item) => item.id)),
    );

    assert.deepEqual(primaryEvidenceIds, expected, request.entityId || "missing entity");
    assert.ok(primaryEvidenceIds.length <= 3);
    assert.equal(new Set(primaryEvidenceIds).size, primaryEvidenceIds.length);
    assert.ok(primaryEvidenceIds.every((id) => callOwnedIds.has(id)));
  }
});
