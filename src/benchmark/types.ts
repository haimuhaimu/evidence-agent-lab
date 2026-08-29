import type {
  AgentRequest,
  CapabilityName,
  Decision,
} from "../core/types";

export type BenchmarkCase = {
  id: string;
  request: AgentRequest;
  expectedIntent: { goal: "diagnose" | "scale"; days: number };
  requiredCapabilities: CapabilityName[];
  forbiddenCapabilities: CapabilityName[];
  requiredEvidence: string[];
  expectedDecision: Decision;
  honestyChecks: string[];
};

export type AuditGates = {
  requestUnderstanding: boolean;
  capabilityPath: boolean;
  evidenceCoverage: boolean;
  decisionCorrectness: boolean;
  honestyBoundary: boolean;
};

export type BenchmarkCaseResult = {
  id: string;
  gates: AuditGates;
  passed: boolean;
};

export type BenchmarkReport = {
  caseCount: number;
  passedCaseCount: number;
  auditPassRate: number;
  gateTotals: Record<keyof AuditGates, number>;
  medianExecutionMs: number;
  cases: BenchmarkCaseResult[];
};

export type BenchmarkSnapshot = Omit<BenchmarkReport, "medianExecutionMs">;
