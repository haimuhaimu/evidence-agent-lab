import type { CapabilityCall, Evidence, SyntheticEntitySnapshot } from "../core/types";
import type { Capability } from "./types";

function safetyEvidence(
  id: "data-completeness" | "publish-age" | "policy-flag",
  claim: string,
  value: number | boolean,
  confidence: Evidence["confidence"],
): Evidence {
  return {
    id,
    capability: "checkSafetyGate",
    claim,
    value,
    source: "synthetic",
    confidence,
  };
}

export const checkSafetyGateCapability: Capability<SyntheticEntitySnapshot, CapabilityCall> = {
  name: "checkSafetyGate",
  run(snapshot) {
    const blockedEvidence: Evidence[] = [];

    if (snapshot.dataCompleteness < 0.75) {
      blockedEvidence.push(safetyEvidence(
        "data-completeness",
        "Data completeness is below the public demo threshold.",
        snapshot.dataCompleteness,
        "high",
      ));
    }

    if (snapshot.publishedHours < 2) {
      blockedEvidence.push(safetyEvidence(
        "publish-age",
        "The entity is too new for downstream diagnosis.",
        snapshot.publishedHours,
        "high",
      ));
    }

    if (snapshot.policyFlag) {
      blockedEvidence.push(safetyEvidence(
        "policy-flag",
        "A synthetic policy flag requires the diagnosis to stop.",
        snapshot.policyFlag,
        "high",
      ));
    }

    if (blockedEvidence.length > 0) {
      return {
        name: "checkSafetyGate",
        status: "blocked",
        evidence: blockedEvidence,
        reason: "The synthetic snapshot did not pass the public safety gate.",
      };
    }

    return {
      name: "checkSafetyGate",
      status: "completed",
      evidence: [
        safetyEvidence(
          "data-completeness",
          "Data completeness meets the public demo threshold.",
          snapshot.dataCompleteness,
          "high",
        ),
        safetyEvidence(
          "publish-age",
          "The entity is old enough for downstream diagnosis.",
          snapshot.publishedHours,
          "high",
        ),
        safetyEvidence(
          "policy-flag",
          "The entity has no synthetic policy flag.",
          snapshot.policyFlag,
          "high",
        ),
      ],
      reason: "The synthetic snapshot passed the public safety gate.",
    };
  },
};

export function checkSafetyGate(snapshot: SyntheticEntitySnapshot): CapabilityCall {
  return checkSafetyGateCapability.run(snapshot);
}
