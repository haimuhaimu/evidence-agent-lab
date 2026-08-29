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

test("evaluates capability, evidence, decision, and honesty failures independently", () => {
  const definition = caseById("click_drop");
  const run = runEvidenceAgent(definition.request);
  const mutations: Array<[keyof ReturnType<typeof evaluateCase>["gates"], AgentRun]> = [
    ["capabilityPath", { ...run, calls: run.calls.slice(0, -1) }],
    ["evidenceCoverage", { ...run, evidence: run.evidence.filter((item) => item.id !== "primary-signal") }],
    ["decisionCorrectness", { ...run, decision: "expected" }],
    ["honestyBoundary", { ...run, boundaryNotes: run.boundaryNotes.slice(0, -1) }],
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
