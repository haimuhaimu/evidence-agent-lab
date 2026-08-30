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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

export function serializeBenchmarkSnapshot(snapshot: BenchmarkSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function benchmarkSnapshotsEqual(
  existing: string,
  expected: BenchmarkSnapshot,
): boolean {
  try {
    const parsed: unknown = JSON.parse(existing);
    return JSON.stringify(canonicalize(parsed))
      === JSON.stringify(canonicalize(expected));
  } catch {
    return false;
  }
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
