import type { AgentRun, Decision, Evidence } from "../core/types";
import { parseAgentRequest } from "../agent/parse-request";

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

function selectPrimaryEvidence(run: AgentRun): Evidence[] {
  const evidenceById = new Map(run.evidence.map((item) => [item.id, item]));
  return run.primaryEvidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => item !== undefined)
    .slice(0, 3);
}

export function isReviewCurrent(
  run: AgentRun,
  form: { entityId: string; query: string },
): boolean {
  const normalizedForm = parseAgentRequest(form);
  return normalizedForm.entityId === run.request.entityId
    && normalizedForm.query === run.request.query;
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
