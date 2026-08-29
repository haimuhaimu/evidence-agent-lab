import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import { BENCHMARK_CASES } from "./cases";
import { evaluateCase } from "./evaluate-case";
import { formatBenchmarkTable, toBenchmarkSnapshot } from "./report";
import { runBenchmark } from "./run-benchmark";

const ALL_GATES_AT_EIGHTEEN = {
  requestUnderstanding: 18,
  capabilityPath: 18,
  evidenceCoverage: 18,
  decisionCorrectness: 18,
  honestyBoundary: 18,
};

function deterministicClock(): () => number {
  let call = 0;

  return () => {
    const caseIndex = Math.floor(call / 2);
    const isEnd = call % 2 === 1;
    call += 1;
    return isEnd ? caseIndex + 1 : 0;
  };
}

test("runs all eighteen cases through the same evidence-agent path", () => {
  const report = runBenchmark(deterministicClock());
  const directResults = BENCHMARK_CASES.map((definition) =>
    evaluateCase(definition, runEvidenceAgent(definition.request))
  );

  assert.deepEqual(report.cases, directResults);
  assert.equal(report.caseCount, 18);
  assert.equal(report.passedCaseCount, 18);
  assert.equal(report.auditPassRate, 1);
  assert.deepEqual(report.gateTotals, ALL_GATES_AT_EIGHTEEN);
});

test("reports the median local execution time from the injected clock", () => {
  const report = runBenchmark(deterministicClock());

  assert.equal(report.medianExecutionMs, 9.5);
});

test("creates a stable snapshot without the local timing field", () => {
  const report = runBenchmark(deterministicClock());
  const snapshot = toBenchmarkSnapshot(report);

  assert.equal(Object.hasOwn(snapshot, "medianExecutionMs"), false);
  assert.deepEqual(snapshot, {
    caseCount: 18,
    passedCaseCount: 18,
    auditPassRate: 1,
    gateTotals: ALL_GATES_AT_EIGHTEEN,
    cases: report.cases,
  });
});

test("formats a short terminal table with the honest audit total", () => {
  const output = formatBenchmarkTable(runBenchmark(deterministicClock()));

  assert.match(output, /Gate\s+Passed\s+Total/);
  assert.match(output, /requestUnderstanding\s+18\s+18/);
  assert.match(output, /honestyBoundary\s+18\s+18/);
  assert.match(output, /Audit Pass Rate: 18\/18 \(100%\)/);
  assert.match(output, /Median execution: 9\.500 ms/);
});
