import type {
  CapabilityCall,
  Evidence,
  EvidenceId,
  SyntheticEntitySnapshot,
} from "../core/types";
import type { Capability } from "./types";

export type SafetyGateCall = CapabilityCall & {
  primaryEvidenceIds: EvidenceId[];
};

function safetyEvidence(
  id: "window-coverage" | "data-completeness" | "publish-age" | "policy-flag",
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

export const checkSafetyGateCapability: Capability<SyntheticEntitySnapshot, SafetyGateCall> = {
  name: "checkSafetyGate",
  run(snapshot) {
    const hasExactWindow = snapshot.metrics?.days === snapshot.requestedDays;
    if (!hasExactWindow) {
      return {
        name: "checkSafetyGate",
        status: "blocked",
        evidence: [safetyEvidence(
          "window-coverage",
          `An exact ${snapshot.requestedDays}-day synthetic metric window is unavailable.`,
          false,
          "high",
        )],
        primaryEvidenceIds: ["window-coverage"],
        reason: `The exact ${snapshot.requestedDays}-day synthetic metric window is unavailable.`,
      };
    }

    const metrics = snapshot.metrics!;
    const ageCoversWindow = snapshot.publishedHours >= snapshot.requestedDays * 24;
    const reasons: string[] = [];
    const primaryEvidenceIds: EvidenceId[] = [];

    if (!ageCoversWindow) {
      reasons.push(
        `Publication age does not cover the requested ${snapshot.requestedDays}-day window.`,
      );
      primaryEvidenceIds.push("window-coverage");
    }

    if (metrics.dataCompleteness < 0.75) {
      reasons.push("Data completeness is below the public demo threshold.");
      primaryEvidenceIds.push("data-completeness");
    }

    if (snapshot.policyFlag) {
      reasons.push("A synthetic policy flag requires the diagnosis to stop.");
      primaryEvidenceIds.push("policy-flag");
    }

    const evidence = [
      safetyEvidence(
        "window-coverage",
        ageCoversWindow
          ? `An exact ${snapshot.requestedDays}-day synthetic metric window is available and covered by publication age.`
          : `An exact ${snapshot.requestedDays}-day metric exists, but publication age cannot cover it.`,
        ageCoversWindow,
        "high",
      ),
      safetyEvidence(
        "data-completeness",
        metrics.dataCompleteness >= 0.75
          ? "Data completeness meets the public demo threshold."
          : "Data completeness is below the public demo threshold.",
        metrics.dataCompleteness,
        "high",
      ),
      safetyEvidence(
        "publish-age",
        ageCoversWindow
          ? "Publication age covers the requested synthetic metric window."
          : "Publication age is shorter than the requested synthetic metric window.",
        snapshot.publishedHours,
        "high",
      ),
      safetyEvidence(
        "policy-flag",
        snapshot.policyFlag
          ? "A synthetic policy flag requires the diagnosis to stop."
          : "The entity has no synthetic policy flag.",
        snapshot.policyFlag,
        "high",
      ),
    ];

    return {
      name: "checkSafetyGate",
      status: reasons.length > 0 ? "blocked" : "completed",
      evidence,
      primaryEvidenceIds,
      reason: reasons.length > 0
        ? reasons.join(" ")
        : "The requested synthetic window passed the public safety gate.",
    };
  },
};

export function checkSafetyGate(snapshot: SyntheticEntitySnapshot): SafetyGateCall {
  return checkSafetyGateCapability.run(snapshot);
}
