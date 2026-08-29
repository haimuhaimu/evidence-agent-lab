import { performance } from "node:perf_hooks";
import { runEvidenceAgent } from "../agent/run-agent";
import { BENCHMARK_CASES } from "./cases";
import { evaluateCase } from "./evaluate-case";
import type { AuditGates, BenchmarkReport } from "./types";

const GATE_NAMES: Array<keyof AuditGates> = [
  "requestUnderstanding",
  "capabilityPath",
  "evidenceCoverage",
  "decisionCorrectness",
  "honestyBoundary",
];

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function runBenchmark(
  now: () => number = () => performance.now(),
): BenchmarkReport {
  const executionTimes: number[] = [];
  const cases = BENCHMARK_CASES.map((definition) => {
    const startedAt = now();
    const run = runEvidenceAgent(definition.request);
    executionTimes.push(now() - startedAt);
    return evaluateCase(definition, run);
  });
  const gateTotals: Record<keyof AuditGates, number> = {
    requestUnderstanding: 0,
    capabilityPath: 0,
    evidenceCoverage: 0,
    decisionCorrectness: 0,
    honestyBoundary: 0,
  };

  for (const result of cases) {
    for (const gate of GATE_NAMES) {
      if (result.gates[gate]) {
        gateTotals[gate] += 1;
      }
    }
  }

  const caseCount = cases.length;
  const passedCaseCount = cases.filter((item) => item.passed).length;

  return {
    caseCount,
    passedCaseCount,
    auditPassRate: caseCount === 0 ? 0 : passedCaseCount / caseCount,
    gateTotals,
    medianExecutionMs: median(executionTimes),
    cases,
  };
}
