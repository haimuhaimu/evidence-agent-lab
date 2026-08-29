import type { CapabilityName } from "../core/types";
import type { BenchmarkCase } from "./types";

export const DEFAULT_HONESTY_CHECKS = [
  "Uses synthetic data only.",
  "Uses a deterministic planner, not free-form model reasoning.",
  "No production action was taken.",
  "No model training occurred.",
] as const;

const ALL_CAPABILITIES: CapabilityName[] = [
  "loadEntitySnapshot",
  "checkSafetyGate",
  "compareHistoricalBaseline",
  "comparePeerBenchmark",
  "attributeSignalDrop",
  "checkDistributionPath",
  "buildEscalationPacket",
];

const BASE_CAPABILITIES = ALL_CAPABILITIES.slice(0, 5);
const BASE_FORBIDDEN = ALL_CAPABILITIES.slice(5);
const BASE_EVIDENCE = [
  "entity-snapshot",
  "data-completeness",
  "publish-age",
  "exposure-vs-history",
  "click-rate-vs-peer",
  "completion-rate-vs-peer",
  "primary-signal",
];

type CaseInput = Omit<BenchmarkCase, "honestyChecks">;

function defineCase(input: CaseInput): BenchmarkCase {
  return {
    ...input,
    requiredCapabilities: [...input.requiredCapabilities],
    forbiddenCapabilities: [...input.forbiddenCapabilities],
    requiredEvidence: [...input.requiredEvidence],
    honestyChecks: [...DEFAULT_HONESTY_CHECKS],
  };
}

function defineBaseCase(
  input: Omit<CaseInput, "requiredCapabilities" | "forbiddenCapabilities" | "requiredEvidence">,
): BenchmarkCase {
  return defineCase({
    ...input,
    requiredCapabilities: BASE_CAPABILITIES,
    forbiddenCapabilities: BASE_FORBIDDEN,
    requiredEvidence: BASE_EVIDENCE,
  });
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  defineBaseCase({
    id: "steady_7d",
    request: { entityId: "content_steady", query: "近 7 天正常吗" },
    expectedIntent: { goal: "diagnose", days: 7 },
    expectedDecision: "expected",
  }),
  defineBaseCase({
    id: "steady_quarter",
    request: { entityId: "content_steady", query: "近一季度正常吗" },
    expectedIntent: { goal: "diagnose", days: 90 },
    expectedDecision: "expected",
  }),
  defineBaseCase({
    id: "steady_half_month",
    request: { entityId: "content_steady", query: "近半个月正常吗" },
    expectedIntent: { goal: "diagnose", days: 15 },
    expectedDecision: "expected",
  }),
  defineBaseCase({
    id: "scale_healthy",
    request: { entityId: "content_scale", query: "近 7 天值得追投吗" },
    expectedIntent: { goal: "scale", days: 7 },
    expectedDecision: "scale",
  }),
  defineBaseCase({
    id: "scale_without_intent",
    request: { entityId: "content_scale", query: "近 7 天正常吗" },
    expectedIntent: { goal: "diagnose", days: 7 },
    expectedDecision: "expected",
  }),
  defineBaseCase({
    id: "click_drop",
    request: { entityId: "content_click_drop", query: "近 7 天为什么掉了" },
    expectedIntent: { goal: "diagnose", days: 7 },
    expectedDecision: "intervene",
  }),
  defineBaseCase({
    id: "retention_drop",
    request: { entityId: "content_retention_drop", query: "近 7 天为什么掉了" },
    expectedIntent: { goal: "diagnose", days: 7 },
    expectedDecision: "intervene",
  }),
  defineCase({
    id: "feed_drop",
    request: { entityId: "content_feed_drop", query: "近 7 天为什么掉了" },
    expectedIntent: { goal: "diagnose", days: 7 },
    requiredCapabilities: ALL_CAPABILITIES,
    forbiddenCapabilities: [],
    requiredEvidence: [...BASE_EVIDENCE, "feed-share-vs-history", "escalation-packet"],
    expectedDecision: "intervene",
  }),
  defineCase({
    id: "incomplete_data",
    request: { entityId: "content_incomplete", query: "近 7 天正常吗" },
    expectedIntent: { goal: "diagnose", days: 7 },
    requiredCapabilities: ALL_CAPABILITIES.slice(0, 2),
    forbiddenCapabilities: ALL_CAPABILITIES.slice(2),
    requiredEvidence: ["entity-snapshot", "data-completeness"],
    expectedDecision: "insufficient_evidence",
  }),
  defineCase({
    id: "unknown_object",
    request: { entityId: "content_missing", query: "近 7 天正常吗" },
    expectedIntent: { goal: "diagnose", days: 7 },
    requiredCapabilities: ALL_CAPABILITIES.slice(0, 1),
    forbiddenCapabilities: ALL_CAPABILITIES.slice(1),
    requiredEvidence: ["entity-not-found"],
    expectedDecision: "insufficient_evidence",
  }),
  defineCase({
    id: "missing_object",
    request: { entityId: "", query: "近 7 天正常吗" },
    expectedIntent: { goal: "diagnose", days: 7 },
    requiredCapabilities: [],
    forbiddenCapabilities: ALL_CAPABILITIES,
    requiredEvidence: [],
    expectedDecision: "insufficient_evidence",
  }),
  defineBaseCase({
    id: "explicit_30d",
    request: { entityId: "content_steady", query: "近 30 天正常吗" },
    expectedIntent: { goal: "diagnose", days: 30 },
    expectedDecision: "expected",
  }),
  defineBaseCase({
    id: "scale_click_drop",
    request: { entityId: "content_click_drop", query: "近 7 天值得追投吗" },
    expectedIntent: { goal: "scale", days: 7 },
    expectedDecision: "intervene",
  }),
  defineCase({
    id: "scale_incomplete",
    request: { entityId: "content_incomplete", query: "近 7 天值得追投吗" },
    expectedIntent: { goal: "scale", days: 7 },
    requiredCapabilities: ALL_CAPABILITIES.slice(0, 2),
    forbiddenCapabilities: ALL_CAPABILITIES.slice(2),
    requiredEvidence: ["entity-snapshot", "data-completeness"],
    expectedDecision: "insufficient_evidence",
  }),
  defineCase({
    id: "feed_drop_quarter",
    request: { entityId: "content_feed_drop", query: "近一季度为什么掉了" },
    expectedIntent: { goal: "diagnose", days: 90 },
    requiredCapabilities: ALL_CAPABILITIES,
    forbiddenCapabilities: [],
    requiredEvidence: [...BASE_EVIDENCE, "feed-share-vs-history", "escalation-packet"],
    expectedDecision: "intervene",
  }),
  defineBaseCase({
    id: "click_drop_quarter",
    request: { entityId: "content_click_drop", query: "近一季度为什么掉了" },
    expectedIntent: { goal: "diagnose", days: 90 },
    expectedDecision: "intervene",
  }),
  defineBaseCase({
    id: "healthy_no_window",
    request: { entityId: "content_steady", query: "现在正常吗" },
    expectedIntent: { goal: "diagnose", days: 7 },
    expectedDecision: "expected",
  }),
  defineBaseCase({
    id: "healthy_scale_30d",
    request: { entityId: "content_scale", query: "近 30 天值得追投吗" },
    expectedIntent: { goal: "scale", days: 30 },
    expectedDecision: "scale",
  }),
];
