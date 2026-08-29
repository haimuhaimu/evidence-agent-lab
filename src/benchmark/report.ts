import type {
  AuditGates,
  BenchmarkReport,
  BenchmarkSnapshot,
} from "./types";

const GATE_NAMES: Array<keyof AuditGates> = [
  "requestUnderstanding",
  "capabilityPath",
  "evidenceCoverage",
  "decisionCorrectness",
  "honestyBoundary",
];

export function toBenchmarkSnapshot(
  report: BenchmarkReport,
): BenchmarkSnapshot {
  return {
    caseCount: report.caseCount,
    passedCaseCount: report.passedCaseCount,
    auditPassRate: report.auditPassRate,
    gateTotals: report.gateTotals,
    cases: report.cases,
  };
}

export function formatBenchmarkTable(report: BenchmarkReport): string {
  const gateWidth = Math.max(
    "Gate".length,
    ...GATE_NAMES.map((name) => name.length),
  );
  const rows = [
    `${"Gate".padEnd(gateWidth)}  Passed  Total`,
    ...GATE_NAMES.map((name) =>
      `${name.padEnd(gateWidth)}  ${String(report.gateTotals[name]).padStart(6)}  ${String(report.caseCount).padStart(5)}`
    ),
  ];
  const percentage = Math.round(report.auditPassRate * 100);

  return [
    ...rows,
    `Audit Pass Rate: ${report.passedCaseCount}/${report.caseCount} (${percentage}%)`,
    `Median execution: ${report.medianExecutionMs.toFixed(3)} ms`,
  ].join("\n");
}
