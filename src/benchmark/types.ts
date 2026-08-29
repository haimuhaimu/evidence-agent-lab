import type {
  AgentRequest,
  CapabilityCall,
  Decision,
  Evidence,
  EvidenceId,
  ParsedRequest,
  RunBoundary,
} from "../core/types";

export type ExpectedCall = Pick<CapabilityCall, "name" | "status">;
export type ExpectedEvidence = Pick<Evidence, "id" | "capability" | "value">;

export type BenchmarkCase = {
  id: string;
  request: AgentRequest;
  expectedRequest: ParsedRequest;
  expectedCalls: ExpectedCall[];
  expectedEvidence: ExpectedEvidence[];
  expectedPrimaryEvidenceIds: EvidenceId[];
  expectedDecision: Decision;
  expectedBoundary: RunBoundary;
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
