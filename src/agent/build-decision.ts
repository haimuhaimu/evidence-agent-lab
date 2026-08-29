import type { Decision } from "../core/types";

export type DecisionContext = {
  blocked: boolean;
  unknowns: string[];
  policyFlag: boolean;
  attributedRisk: boolean;
  distributionRisk: boolean;
  goal: "diagnose" | "scale";
  exposureDelta: number;
  clickPeerDelta: number;
  completionPeerDelta: number;
};

export function buildDecision(context: DecisionContext): Decision {
  if (context.blocked || context.unknowns.length > 0) {
    return "insufficient_evidence";
  }

  if (context.policyFlag || context.attributedRisk || context.distributionRisk) {
    return "intervene";
  }

  if (
    context.goal === "scale"
    && context.exposureDelta >= 0.1
    && context.clickPeerDelta >= 0
    && context.completionPeerDelta >= 0
  ) {
    return "scale";
  }

  return "expected";
}
