import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import type { AgentRun } from "../core/types";
import { BENCHMARK_CASES } from "./cases";
import { evaluateCase } from "./evaluate-case";

function caseById(id: string) {
  const definition = BENCHMARK_CASES.find((item) => item.id === id);
  assert.ok(definition);
  return definition;
}

test("passes an honest insufficient-evidence stop when every audit gate matches", () => {
  const definition = caseById("incomplete_data");
  const result = evaluateCase(definition, runEvidenceAgent(definition.request));

  assert.deepEqual(result, {
    id: "incomplete_data",
    gates: {
      requestUnderstanding: true,
      capabilityPath: true,
      evidenceCoverage: true,
      decisionCorrectness: true,
      honestyBoundary: true,
    },
    passed: true,
  });
});

test("fails only the request-understanding gate for a wrong parsed window", () => {
  const definition = caseById("steady_7d");
  const run = runEvidenceAgent(definition.request);
  const wrongWindow: AgentRun = {
    ...run,
    request: { ...run.request, days: 30 },
  };

  assert.deepEqual(evaluateCase(definition, wrongWindow).gates, {
    requestUnderstanding: false,
    capabilityPath: true,
    evidenceCoverage: true,
    decisionCorrectness: true,
    honestyBoundary: true,
  });
});

test("rejects a wrong entity and a fabricated clarification state", () => {
  const definition = caseById("steady_7d");
  const run = runEvidenceAgent(definition.request);

  for (const request of [
    { ...run.request, entityId: "content_scale" },
    { ...run.request, clarificationNeeded: ["Fabricated gap."] },
  ]) {
    assert.equal(evaluateCase(definition, { ...run, request }).gates.requestUnderstanding, false);
  }
});

test("rejects reordered, duplicate, blocked, or otherwise unexpected calls", () => {
  const definition = caseById("click_drop");
  const run = runEvidenceAgent(definition.request);
  const reordered = [...run.calls];
  [reordered[2], reordered[3]] = [reordered[3], reordered[2]];
  const duplicate = [...run.calls, run.calls.at(-1)!];
  const blocked = run.calls.map((call, index) => (
    index === 2 ? { ...call, status: "blocked" as const } : call
  ));

  for (const calls of [reordered, duplicate, blocked]) {
    assert.equal(evaluateCase(definition, { ...run, calls }).gates.capabilityPath, false);
  }
});

test("rejects orphaned evidence, wrong capability ownership, and non-finite evidence", () => {
  const definition = caseById("click_drop");
  const run = runEvidenceAgent(definition.request);
  const orphaned = {
    ...run,
    evidence: [...run.evidence, { ...run.evidence[0], id: "orphan-evidence" }],
  };
  const wrongCalls = run.calls.map((call) => call.name === "attributeSignalDrop"
    ? {
        ...call,
        evidence: call.evidence.map((item) => ({
          ...item,
          capability: "comparePeerBenchmark" as const,
        })),
      }
    : call);
  const wrongOwner = { ...run, calls: wrongCalls, evidence: wrongCalls.flatMap((call) => call.evidence) };
  const nonFiniteCalls = run.calls.map((call) => call.name === "compareHistoricalBaseline"
    ? {
        ...call,
        evidence: call.evidence.map((item) => ({ ...item, value: Number.NaN })),
      }
    : call);
  const nonFinite = {
    ...run,
    calls: nonFiniteCalls,
    evidence: nonFiniteCalls.flatMap((call) => call.evidence),
  };

  for (const mutation of [orphaned, wrongOwner, nonFinite]) {
    assert.equal(
      evaluateCase(definition, mutation as unknown as AgentRun).gates.evidenceCoverage,
      false,
    );
  }
});

test("rejects orphaned runner relevance even when the evidence trace is otherwise valid", () => {
  const definition = caseById("feed_drop");
  const run = runEvidenceAgent(definition.request);
  const orphanedRelevance = {
    ...run,
    primaryEvidenceIds: ["orphan-evidence"],
  } as unknown as AgentRun;

  assert.equal(
    evaluateCase(definition, orphanedRelevance).gates.evidenceCoverage,
    false,
  );
});

test("rejects contradictory structured action, training, delivery, and causal claims", () => {
  const definition = caseById("steady_7d");
  const run = runEvidenceAgent(definition.request);
  const mutations = [
    { action: "production_write" },
    { training: "updated_model" },
    { delivery: "sent" },
    { causal: "confirmed" },
  ];

  for (const mutation of mutations) {
    const changed = { ...run, boundary: { ...run.boundary, ...mutation } } as AgentRun;
    assert.equal(evaluateCase(definition, changed).gates.honestyBoundary, false);
  }
});

test("rejects fabricated missing evidence and a sent escalation packet", () => {
  const incompleteDefinition = caseById("incomplete_data");
  const incomplete = runEvidenceAgent(incompleteDefinition.request);
  const fabricatedCalls = incomplete.calls.map((call) => ({
    ...call,
    evidence: call.evidence.map((item) => item.id === "data-completeness"
      ? { ...item, value: 1 }
      : item),
  }));
  const fabricated = {
    ...incomplete,
    calls: fabricatedCalls,
    evidence: fabricatedCalls.flatMap((call) => call.evidence),
  };
  assert.equal(evaluateCase(incompleteDefinition, fabricated).gates.evidenceCoverage, false);

  const feedDefinition = caseById("feed_drop");
  const feed = runEvidenceAgent(feedDefinition.request);
  const sentCalls = feed.calls.map((call) => call.name === "buildEscalationPacket"
    ? {
        ...call,
        evidence: call.evidence.map((item) => ({ ...item, value: "sent" })),
      }
    : call);
  const sent = {
    ...feed,
    calls: sentCalls,
    evidence: sentCalls.flatMap((call) => call.evidence),
    boundary: { ...feed.boundary, delivery: "sent" },
  } as unknown as AgentRun;
  const result = evaluateCase(feedDefinition, sent);
  assert.equal(result.gates.evidenceCoverage, false);
  assert.equal(result.gates.honestyBoundary, false);
});

test("evaluates capability, evidence, decision, and honesty failures independently", () => {
  const definition = caseById("click_drop");
  const run = runEvidenceAgent(definition.request);
  const mutations: Array<[keyof ReturnType<typeof evaluateCase>["gates"], AgentRun]> = [
    ["capabilityPath", {
      ...run,
      calls: run.calls.map((call, index) => index === 2
        ? { ...call, status: "blocked" as const }
        : call),
    }],
    ["evidenceCoverage", { ...run, evidence: run.evidence.filter((item) => item.id !== "primary-signal") }],
    ["decisionCorrectness", { ...run, decision: "expected" }],
    ["honestyBoundary", {
      ...run,
      boundary: { ...run.boundary, training: "updated_model" },
    } as unknown as AgentRun],
  ];

  for (const [failedGate, mutatedRun] of mutations) {
    const result = evaluateCase(definition, mutatedRun);
    assert.equal(result.gates[failedGate], false, failedGate);
    assert.equal(result.passed, false, failedGate);
    assert.equal(
      Object.entries(result.gates).filter(([, passed]) => !passed).length,
      1,
      failedGate,
    );
  }
});
