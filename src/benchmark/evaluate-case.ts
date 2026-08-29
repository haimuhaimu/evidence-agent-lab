import type { AgentRun } from "../core/types";
import type { BenchmarkCase, BenchmarkCaseResult } from "./types";

export function evaluateCase(
  definition: BenchmarkCase,
  run: AgentRun,
): BenchmarkCaseResult {
  const called = new Set(run.calls.map((call) => call.name));
  const evidence = new Set(run.evidence.map((item) => item.id));
  const gates = {
    requestUnderstanding:
      run.request.goal === definition.expectedIntent.goal
      && run.request.days === definition.expectedIntent.days,
    capabilityPath:
      definition.requiredCapabilities.every((name) => called.has(name))
      && definition.forbiddenCapabilities.every((name) => !called.has(name)),
    evidenceCoverage: definition.requiredEvidence.every((id) => evidence.has(id)),
    decisionCorrectness: run.decision === definition.expectedDecision,
    honestyBoundary: definition.honestyChecks.every((note) => run.boundaryNotes.includes(note)),
  };

  return {
    id: definition.id,
    gates,
    passed: Object.values(gates).every(Boolean),
  };
}
