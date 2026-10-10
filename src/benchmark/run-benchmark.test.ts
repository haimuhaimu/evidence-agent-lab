import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import { BENCHMARK_CASES } from "./cases";
import { evaluateCase } from "./evaluate-case";
import {
  benchmarkSnapshotsEqual,
  formatBenchmarkTable,
  serializeBenchmarkSnapshot,
  toBenchmarkSnapshot,
} from "./report";
import { runBenchmark } from "./run-benchmark";

const ALL_GATES_AT_TWENTY = {
  requestUnderstanding: 20,
  capabilityPath: 20,
  evidenceCoverage: 20,
  decisionCorrectness: 20,
  honestyBoundary: 20,
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

test("runs all twenty cases through the same evidence-agent path", () => {
  const report = runBenchmark(deterministicClock());
  const directResults = BENCHMARK_CASES.map((definition) =>
    evaluateCase(definition, runEvidenceAgent(definition.request))
  );

  assert.deepEqual(report.cases, directResults);
  assert.equal(report.caseCount, 20);
  assert.equal(report.passedCaseCount, 20);
  assert.equal(report.auditPassRate, 1);
  assert.deepEqual(report.gateTotals, ALL_GATES_AT_TWENTY);
});

test("reports the median local execution time from the injected clock", () => {
  const report = runBenchmark(deterministicClock());

  assert.equal(report.medianExecutionMs, 10.5);
});

test("creates a stable snapshot without the local timing field", () => {
  const report = runBenchmark(deterministicClock());
  const snapshot = toBenchmarkSnapshot(report);

  assert.equal(Object.hasOwn(snapshot, "medianExecutionMs"), false);
  assert.deepEqual(snapshot, {
    caseCount: 20,
    passedCaseCount: 20,
    auditPassRate: 1,
    gateTotals: ALL_GATES_AT_TWENTY,
    cases: report.cases,
  });
});

test("compares benchmark snapshots canonically across CRLF without accepting semantic changes", () => {
  const snapshot = toBenchmarkSnapshot(runBenchmark(deterministicClock()));
  const serialized = serializeBenchmarkSnapshot(snapshot);

  assert.equal(benchmarkSnapshotsEqual(serialized.replaceAll("\n", "\r\n"), snapshot), true);
  assert.equal(benchmarkSnapshotsEqual(serialized.replace('"caseCount": 20', '"caseCount": 19'), snapshot), false);
  assert.equal(benchmarkSnapshotsEqual("not-json", snapshot), false);
});

test("formats a short terminal table with the honest audit total", () => {
  const output = formatBenchmarkTable(runBenchmark(deterministicClock()));

  assert.match(output, /Gate\s+Passed\s+Total/);
  assert.match(output, /requestUnderstanding\s+20\s+20/);
  assert.match(output, /honestyBoundary\s+20\s+20/);
  assert.match(output, /Audit Pass Rate: 20\/20 \(100%\)/);
  assert.match(output, /Median execution: 10\.500 ms/);
});
