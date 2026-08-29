import type { AgentRun, Decision, Evidence } from "../core/types";

const DECISION_COPY: Record<Decision, { title: string; summary: string }> = {
  expected: {
    title: "Expected",
    summary: "The synthetic evidence stays within the declared demo thresholds.",
  },
  scale: {
    title: "Worth scaling",
    summary: "The synthetic evidence supports controlled expansion for this request.",
  },
  intervene: {
    title: "Needs intervention",
    summary: "A declared synthetic risk signal crossed the demo threshold.",
  },
  insufficient_evidence: {
    title: "Insufficient evidence",
    summary: "The run stopped at a concrete evidence gap shown below.",
  },
};

function byId(run: AgentRun, id: string): Evidence | undefined {
  return run.evidence.find((item) => item.id === id);
}

function compactEvidence(items: Array<Evidence | undefined>): Evidence[] {
  const seen = new Set<string>();
  return items.filter((item): item is Evidence => {
    if (!item || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  }).slice(0, 3);
}

function isBlockingEvidence(evidence: Evidence): boolean {
  return evidence.id === "entity-not-found"
    || (evidence.id === "window-coverage" && evidence.value === false)
    || (
      evidence.id === "data-completeness"
      && typeof evidence.value === "number"
      && evidence.value < 0.75
    )
    || (evidence.id === "policy-flag" && evidence.value === true)
    || evidence.confidence === "low";
}

function selectPrimaryEvidence(run: AgentRun): Evidence[] {
  if (run.decision === "insufficient_evidence") {
    const blockedCall = [...run.calls].reverse().find((call) => call.status === "blocked");
    return compactEvidence(blockedCall?.evidence.filter(isBlockingEvidence) ?? []);
  }

  if (run.decision === "intervene") {
    const feedShare = byId(run, "feed-share-vs-history");
    if (
      feedShare
      && typeof feedShare.value === "number"
      && feedShare.value <= -0.2
    ) {
      return compactEvidence([
        feedShare,
        byId(run, "exposure-vs-history"),
        byId(run, "exposure-vs-peer"),
      ]);
    }

    const primarySignal = byId(run, "primary-signal");
    return compactEvidence([
      primarySignal,
      byId(run, "exposure-vs-history"),
      primarySignal?.value === "completion_rate"
        ? byId(run, "completion-rate-vs-peer")
        : byId(run, "click-rate-vs-peer"),
    ]);
  }

  return compactEvidence([
    byId(run, "exposure-vs-history"),
    byId(run, "click-rate-vs-peer"),
    byId(run, "completion-rate-vs-peer"),
  ]);
}

export function isReviewCurrent(
  run: AgentRun,
  form: { entityId: string; query: string },
): boolean {
  return form.entityId === run.request.entityId && form.query === run.request.query;
}

export function buildAgentViewModel(run: AgentRun) {
  return {
    decision: run.decision,
    title: DECISION_COPY[run.decision].title,
    summary: DECISION_COPY[run.decision].summary,
    primaryEvidence: selectPrimaryEvidence(run),
    unknowns: [...run.unknowns],
    falsification: [...run.falsification],
    traceCount: run.calls.length,
    reviewedRequest: {
      entityId: run.request.entityId,
      query: run.request.query,
    },
    disclosure: "Deterministic planner. Synthetic data. No production action.",
  };
}
