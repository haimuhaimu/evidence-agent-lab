import type { AgentRun, Decision } from "../core/types";

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
    summary: "The run stopped because the available synthetic evidence is incomplete.",
  },
};

export function buildAgentViewModel(run: AgentRun) {
  return {
    decision: run.decision,
    title: DECISION_COPY[run.decision].title,
    summary: DECISION_COPY[run.decision].summary,
    primaryEvidence: run.evidence.slice(0, 3),
    unknowns: run.unknowns,
    falsification: run.falsification,
    traceCount: run.calls.length,
    disclosure: "Deterministic planner. Synthetic data. No production action.",
  };
}
