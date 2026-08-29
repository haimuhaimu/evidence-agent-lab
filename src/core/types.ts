export type Decision = "expected" | "scale" | "intervene" | "insufficient_evidence";
export type Confidence = "low" | "medium" | "high";
export type CapabilityName =
  | "loadEntitySnapshot"
  | "checkSafetyGate"
  | "compareHistoricalBaseline"
  | "comparePeerBenchmark"
  | "attributeSignalDrop"
  | "checkDistributionPath"
  | "buildEscalationPacket";

export type Evidence = {
  id: string;
  capability: CapabilityName;
  claim: string;
  value: number | string | boolean;
  source: "synthetic";
  confidence: Confidence;
};

export type CapabilityCall = {
  name: CapabilityName;
  status: "completed" | "blocked" | "skipped";
  evidence: Evidence[];
  reason: string;
};

export type AgentRun = {
  request: ParsedRequest;
  calls: CapabilityCall[];
  decision: Decision;
  evidence: Evidence[];
  unknowns: string[];
  falsification: string[];
  boundaryNotes: string[];
  boundary: RunBoundary;
};

export type RunBoundary = {
  scope: "synthetic_only";
  planner: "deterministic";
  action: "none";
  training: "none";
  delivery: "none" | "not_sent";
  causal: "not_claimed";
};

export type AgentRequest = {
  entityId: string;
  query: string;
};

export type ParsedRequest = {
  entityId: string;
  query: string;
  days: number;
  goal: "diagnose" | "scale";
  clarificationNeeded: string[];
};

export type SyntheticWindowMetrics = Readonly<{
  days: number;
  dataCompleteness: number;
  exposure: number;
  historicalExposureMedian: number;
  peerExposureMedian: number;
  clickRate: number;
  peerClickRate: number;
  completionRate: number;
  peerCompletionRate: number;
  feedShare: number;
  historicalFeedShare: number;
}>;

export type SyntheticEntityFixture = Readonly<{
  id: string;
  source: "synthetic";
  publishedHours: number;
  policyFlag: boolean;
  windows: ReadonlyArray<SyntheticWindowMetrics>;
}>;

export type SyntheticEntitySnapshot = Readonly<{
  id: string;
  source: "synthetic";
  publishedHours: number;
  policyFlag: boolean;
  requestedDays: number;
  metrics: SyntheticWindowMetrics | null;
}>;
