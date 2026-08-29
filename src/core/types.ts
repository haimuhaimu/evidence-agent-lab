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

export type SyntheticEntitySnapshot = {
  id: string;
  source: "synthetic";
  publishedHours: number;
  dataCompleteness: number;
  policyFlag: boolean;
  exposure: number;
  historicalExposureMedian: number;
  peerExposureMedian: number;
  clickRate: number;
  peerClickRate: number;
  completionRate: number;
  peerCompletionRate: number;
  feedShare: number;
  historicalFeedShare: number;
};
