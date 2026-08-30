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

export type EvidenceId =
  | "entity-snapshot"
  | "entity-not-found"
  | "window-coverage"
  | "data-completeness"
  | "publish-age"
  | "policy-flag"
  | "exposure-vs-history"
  | "exposure-vs-peer"
  | "click-rate-vs-peer"
  | "completion-rate-vs-peer"
  | "primary-signal"
  | "feed-share-vs-history"
  | "escalation-packet";

export type Evidence = {
  id: EvidenceId;
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
  primaryEvidenceIds: EvidenceId[];
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
