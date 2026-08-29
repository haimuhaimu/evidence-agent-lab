import type {
  CapabilityName,
  Decision,
  RunBoundary,
} from "../core/types";
import type {
  BenchmarkCase,
  ExpectedCall,
  ExpectedEvidence,
} from "./types";

export const DEFAULT_BOUNDARY: RunBoundary = {
  scope: "synthetic_only",
  planner: "deterministic",
  action: "none",
  training: "none",
  delivery: "none",
  causal: "not_claimed",
};

const BASE_CALLS: ExpectedCall[] = [
  "loadEntitySnapshot",
  "checkSafetyGate",
  "compareHistoricalBaseline",
  "comparePeerBenchmark",
  "attributeSignalDrop",
].map((name) => ({ name: name as CapabilityName, status: "completed" }));

const FEED_CALLS: ExpectedCall[] = [
  ...BASE_CALLS,
  { name: "checkDistributionPath", status: "completed" },
  { name: "buildEscalationPacket", status: "completed" },
];

type MetricProfile = {
  completeness: number;
  exposureDelta: number;
  clickRateDelta: number;
  completionRateDelta: number;
  primarySignal: "click_rate" | "completion_rate" | "none";
};

const PROFILES: Record<string, MetricProfile> = {
  content_steady: {
    completeness: 1,
    exposureDelta: 0,
    clickRateDelta: 0,
    completionRateDelta: 0,
    primarySignal: "none",
  },
  content_scale: {
    completeness: 1,
    exposureDelta: 0.4,
    clickRateDelta: (0.07 - 0.05) / 0.05,
    completionRateDelta: (0.7 - 0.6) / 0.6,
    primarySignal: "none",
  },
  content_click_drop: {
    completeness: 1,
    exposureDelta: -0.4,
    clickRateDelta: (0.02 - 0.05) / 0.05,
    completionRateDelta: 0,
    primarySignal: "click_rate",
  },
  content_retention_drop: {
    completeness: 1,
    exposureDelta: -0.3,
    clickRateDelta: 0,
    completionRateDelta: (0.3 - 0.6) / 0.6,
    primarySignal: "completion_rate",
  },
  content_feed_drop: {
    completeness: 1,
    exposureDelta: -0.3,
    clickRateDelta: 0,
    completionRateDelta: 0,
    primarySignal: "none",
  },
  content_incomplete: {
    completeness: 0.5,
    exposureDelta: -0.4,
    clickRateDelta: 0,
    completionRateDelta: 0,
    primarySignal: "none",
  },
};

function safetyEvidence(entityId: string): ExpectedEvidence[] {
  const profile = PROFILES[entityId];
  return [
    { id: "entity-snapshot", capability: "loadEntitySnapshot", value: entityId },
    { id: "window-coverage", capability: "checkSafetyGate", value: true },
    { id: "data-completeness", capability: "checkSafetyGate", value: profile.completeness },
    { id: "publish-age", capability: "checkSafetyGate", value: 100 * 24 },
    { id: "policy-flag", capability: "checkSafetyGate", value: false },
  ];
}

function baseEvidence(entityId: string): ExpectedEvidence[] {
  const profile = PROFILES[entityId];
  return [
    ...safetyEvidence(entityId),
    {
      id: "exposure-vs-history",
      capability: "compareHistoricalBaseline",
      value: profile.exposureDelta,
    },
    {
      id: "exposure-vs-peer",
      capability: "comparePeerBenchmark",
      value: profile.exposureDelta,
    },
    {
      id: "click-rate-vs-peer",
      capability: "comparePeerBenchmark",
      value: profile.clickRateDelta,
    },
    {
      id: "completion-rate-vs-peer",
      capability: "comparePeerBenchmark",
      value: profile.completionRateDelta,
    },
    {
      id: "primary-signal",
      capability: "attributeSignalDrop",
      value: profile.primarySignal,
    },
  ];
}

type DefinedCase = {
  id: string;
  entityId: string;
  query: string;
  goal: "diagnose" | "scale";
  days: number;
  expectedDecision: Decision;
  calls?: ExpectedCall[];
  evidence?: ExpectedEvidence[];
  clarificationNeeded?: string[];
};

function defineCase(input: DefinedCase): BenchmarkCase {
  const calls = input.calls ?? BASE_CALLS;
  const evidence = input.evidence ?? baseEvidence(input.entityId);
  return {
    id: input.id,
    request: { entityId: input.entityId, query: input.query },
    expectedRequest: {
      entityId: input.entityId,
      query: input.query,
      goal: input.goal,
      days: input.days,
      clarificationNeeded: [...(input.clarificationNeeded ?? [])],
    },
    expectedCalls: calls.map((call) => ({ ...call })),
    expectedEvidence: evidence.map((item) => ({ ...item })),
    expectedDecision: input.expectedDecision,
    expectedBoundary: {
      ...DEFAULT_BOUNDARY,
      delivery: calls.some((call) => call.name === "buildEscalationPacket")
        ? "not_sent"
        : "none",
    },
  };
}

function defineFeedCase(input: Omit<DefinedCase, "calls" | "evidence">): BenchmarkCase {
  return defineCase({
    ...input,
    calls: FEED_CALLS,
    evidence: [
      ...baseEvidence(input.entityId),
      {
        id: "feed-share-vs-history",
        capability: "checkDistributionPath",
        value: (0.1 - 0.3) / 0.3,
      },
      {
        id: "escalation-packet",
        capability: "buildEscalationPacket",
        value: "not_sent",
      },
    ],
  });
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  defineCase({ id: "steady_7d", entityId: "content_steady", query: "近 7 天正常吗", goal: "diagnose", days: 7, expectedDecision: "expected" }),
  defineCase({ id: "steady_quarter", entityId: "content_steady", query: "近一季度正常吗", goal: "diagnose", days: 90, expectedDecision: "expected" }),
  defineCase({ id: "steady_half_month", entityId: "content_steady", query: "近半个月正常吗", goal: "diagnose", days: 15, expectedDecision: "expected" }),
  defineCase({ id: "scale_healthy", entityId: "content_scale", query: "近 7 天值得追投吗", goal: "scale", days: 7, expectedDecision: "scale" }),
  defineCase({ id: "scale_without_intent", entityId: "content_scale", query: "近 7 天正常吗", goal: "diagnose", days: 7, expectedDecision: "expected" }),
  defineCase({ id: "click_drop", entityId: "content_click_drop", query: "近 7 天为什么掉了", goal: "diagnose", days: 7, expectedDecision: "intervene" }),
  defineCase({ id: "retention_drop", entityId: "content_retention_drop", query: "近 7 天为什么掉了", goal: "diagnose", days: 7, expectedDecision: "intervene" }),
  defineFeedCase({ id: "feed_drop", entityId: "content_feed_drop", query: "近 7 天为什么掉了", goal: "diagnose", days: 7, expectedDecision: "intervene" }),
  defineCase({
    id: "incomplete_data",
    entityId: "content_incomplete",
    query: "近 7 天正常吗",
    goal: "diagnose",
    days: 7,
    expectedDecision: "insufficient_evidence",
    calls: [
      { name: "loadEntitySnapshot", status: "completed" },
      { name: "checkSafetyGate", status: "blocked" },
    ],
    evidence: safetyEvidence("content_incomplete"),
  }),
  defineCase({
    id: "unknown_object",
    entityId: "content_missing",
    query: "近 7 天正常吗",
    goal: "diagnose",
    days: 7,
    expectedDecision: "insufficient_evidence",
    calls: [{ name: "loadEntitySnapshot", status: "blocked" }],
    evidence: [{
      id: "entity-not-found",
      capability: "loadEntitySnapshot",
      value: "content_missing",
    }],
  }),
  defineCase({
    id: "missing_object",
    entityId: "",
    query: "近 7 天正常吗",
    goal: "diagnose",
    days: 7,
    expectedDecision: "insufficient_evidence",
    calls: [],
    evidence: [],
    clarificationNeeded: ["Choose a synthetic content object."],
  }),
  defineCase({ id: "explicit_30d", entityId: "content_steady", query: "近 30 天正常吗", goal: "diagnose", days: 30, expectedDecision: "expected" }),
  defineCase({ id: "scale_click_drop", entityId: "content_click_drop", query: "近 7 天值得追投吗", goal: "scale", days: 7, expectedDecision: "intervene" }),
  defineCase({
    id: "scale_incomplete",
    entityId: "content_incomplete",
    query: "近 7 天值得追投吗",
    goal: "scale",
    days: 7,
    expectedDecision: "insufficient_evidence",
    calls: [
      { name: "loadEntitySnapshot", status: "completed" },
      { name: "checkSafetyGate", status: "blocked" },
    ],
    evidence: safetyEvidence("content_incomplete"),
  }),
  defineFeedCase({ id: "feed_drop_quarter", entityId: "content_feed_drop", query: "近一季度为什么掉了", goal: "diagnose", days: 90, expectedDecision: "intervene" }),
  defineCase({ id: "click_drop_quarter", entityId: "content_click_drop", query: "近一季度为什么掉了", goal: "diagnose", days: 90, expectedDecision: "intervene" }),
  defineCase({ id: "healthy_no_window", entityId: "content_steady", query: "现在正常吗", goal: "diagnose", days: 7, expectedDecision: "expected" }),
  defineCase({ id: "healthy_scale_30d", entityId: "content_scale", query: "近 30 天值得追投吗", goal: "scale", days: 30, expectedDecision: "scale" }),
];
