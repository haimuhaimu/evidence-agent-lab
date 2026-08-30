import { CAPABILITY_REGISTRY } from "../capabilities/registry";
import type {
  AgentRequest,
  AgentRun,
  CapabilityCall,
  Decision,
  EvidenceId,
  ParsedRequest,
} from "../core/types";
import { buildDecision, type DecisionContext } from "./build-decision";
import { parseAgentRequest } from "./parse-request";
import { planCapabilities } from "./plan-capabilities";

const BOUNDARY_NOTES = [
  "Uses synthetic data only.",
  "Uses a deterministic planner, not free-form model reasoning.",
  "No production action was taken.",
  "No model training occurred.",
];

function finishRun(
  request: ParsedRequest,
  calls: CapabilityCall[],
  decision: Decision,
  unknowns: string[],
  falsification: string[],
  primaryEvidenceIds: EvidenceId[],
): AgentRun {
  const callOwnedEvidenceIds = new Set(
    calls.flatMap((call) => call.evidence.map((item) => item.id)),
  );
  if (
    primaryEvidenceIds.length > 3
    || new Set(primaryEvidenceIds).size !== primaryEvidenceIds.length
    || primaryEvidenceIds.some((id) => !callOwnedEvidenceIds.has(id))
  ) {
    throw new Error("Primary evidence must be unique, call-owned, and limited to three items.");
  }

  return {
    request,
    calls,
    decision,
    evidence: calls.flatMap((call) => call.evidence),
    primaryEvidenceIds: [...primaryEvidenceIds],
    unknowns: [...unknowns],
    falsification,
    boundaryNotes: [...BOUNDARY_NOTES],
    boundary: {
      scope: "synthetic_only",
      planner: "deterministic",
      action: "none",
      training: "none",
      delivery: calls.some((call) => call.name === "buildEscalationPacket")
        ? "not_sent"
        : "none",
      causal: "not_claimed",
    },
  };
}

function buildFalsification(
  decision: Decision,
  context: DecisionContext,
): string[] {
  if (decision === "insufficient_evidence") {
    return context.unknowns.length > 0
      ? ["Resolve the listed evidence gaps, then rerun the same synthetic checks."]
      : ["Pass the blocked synthetic evidence gate before drawing a conclusion."];
  }

  if (decision === "intervene") {
    if (context.distributionRisk) {
      return ["The classification would change if synthetic Feed share rose above the demo risk threshold."];
    }

    return ["The classification would change if the observed metric and exposure no longer crossed the demo thresholds."];
  }

  if (decision === "scale") {
    return ["The decision would change if exposure growth fell below 10% or either peer metric delta turned negative."];
  }

  return ["The decision would change if the synthetic evidence crossed a declared risk or scale threshold."];
}

function finishFromContext(
  request: ParsedRequest,
  calls: CapabilityCall[],
  context: DecisionContext,
  primaryEvidenceIds: EvidenceId[] = [],
): AgentRun {
  const decision = buildDecision(context);

  return finishRun(
    request,
    calls,
    decision,
    context.unknowns,
    buildFalsification(decision, context),
    primaryEvidenceIds,
  );
}

export function runEvidenceAgent(request: AgentRequest): AgentRun {
  const parsed = parseAgentRequest(request);
  const planned = planCapabilities(parsed, undefined);
  const context: DecisionContext = {
    blocked: false,
    unknowns: [...parsed.clarificationNeeded],
    policyFlag: false,
    attributedRisk: false,
    distributionRisk: false,
    goal: parsed.goal,
    exposureDelta: 0,
    clickPeerDelta: 0,
    completionPeerDelta: 0,
  };

  if (planned.length === 0) {
    return finishFromContext(parsed, [], context);
  }

  const loaded = CAPABILITY_REGISTRY.loadEntitySnapshot({
    entityId: parsed.entityId,
    days: parsed.days,
  });
  const calls = [loaded.call];
  if (!loaded.snapshot) {
    context.blocked = true;
    context.unknowns.push(loaded.call.reason);
    return finishFromContext(parsed, calls, context, ["entity-not-found"]);
  }

  context.policyFlag = loaded.snapshot.policyFlag;
  const safety = CAPABILITY_REGISTRY.checkSafetyGate(loaded.snapshot);
  calls.push(safety);
  if (safety.status === "blocked") {
    context.blocked = true;
    if (!loaded.snapshot.policyFlag) {
      context.unknowns.push(safety.reason);
    }
    return finishFromContext(parsed, calls, context, safety.primaryEvidenceIds);
  }

  const historical = CAPABILITY_REGISTRY.compareHistoricalBaseline(loaded.snapshot);
  calls.push(historical.call);
  context.exposureDelta = historical.exposureDelta;
  if (historical.call.status === "blocked") {
    context.blocked = true;
    context.unknowns.push(historical.call.reason);
    return finishFromContext(
      parsed,
      calls,
      context,
      historical.call.evidence.map((item) => item.id),
    );
  }

  const peer = CAPABILITY_REGISTRY.comparePeerBenchmark(loaded.snapshot);
  calls.push(peer.call);
  context.clickPeerDelta = peer.clickRateDelta;
  context.completionPeerDelta = peer.completionRateDelta;
  if (peer.call.status === "blocked") {
    context.blocked = true;
    context.unknowns.push(peer.call.reason);
    return finishFromContext(
      parsed,
      calls,
      context,
      peer.call.evidence.filter((item) => item.confidence === "low").map((item) => item.id),
    );
  }

  const attribution = CAPABILITY_REGISTRY.attributeSignalDrop({ historical, peer });
  calls.push(attribution.call);
  if (attribution.call.status === "blocked") {
    context.blocked = true;
    context.unknowns.push(attribution.call.reason);
    return finishFromContext(
      parsed,
      calls,
      context,
      attribution.call.evidence.map((item) => item.id),
    );
  }

  context.attributedRisk = attribution.explainsExposureDrop;

  if (historical.exposureDelta < 0 && !attribution.explainsExposureDrop) {
    const distribution = CAPABILITY_REGISTRY.checkDistributionPath(
      loaded.snapshot,
      attribution,
    );
    calls.push(distribution.call);
    if (distribution.call.status === "blocked") {
      context.blocked = true;
      context.unknowns.push(distribution.call.reason);
      return finishFromContext(
        parsed,
        calls,
        context,
        distribution.call.evidence.map((item) => item.id),
      );
    }

    context.distributionRisk = distribution.status === "risk";
  }

  const decision = buildDecision(context);
  if (
    decision === "intervene"
    && (context.distributionRisk || context.policyFlag)
  ) {
    const evidenceIds = calls.flatMap((call) => call.evidence.map((item) => item.id));
    const packet = CAPABILITY_REGISTRY.buildEscalationPacket(parsed.entityId, evidenceIds);
    calls.push(packet.call);
  }

  const primaryEvidenceIds: EvidenceId[] = context.distributionRisk
    ? ["feed-share-vs-history", "exposure-vs-history", "exposure-vs-peer"]
    : attribution.primarySignal === "click_rate"
      ? ["primary-signal", "exposure-vs-history", "click-rate-vs-peer"]
      : attribution.primarySignal === "completion_rate"
        ? ["primary-signal", "exposure-vs-history", "completion-rate-vs-peer"]
        : ["exposure-vs-history", "click-rate-vs-peer", "completion-rate-vs-peer"];

  return finishRun(
    parsed,
    calls,
    decision,
    context.unknowns,
    buildFalsification(decision, context),
    primaryEvidenceIds,
  );
}
