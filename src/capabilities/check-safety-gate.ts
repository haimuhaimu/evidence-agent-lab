import type { CapabilityCall, Evidence, SyntheticEntitySnapshot } from "../core/types";
import type { Capability } from "./types";

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

export const checkSafetyGateCapability: Capability<SyntheticEntitySnapshot, CapabilityCall> = {
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
        reason: `The exact ${snapshot.requestedDays}-day synthetic metric window is unavailable.`,
      };
    }

    const metrics = snapshot.metrics!;
    const ageCoversWindow = snapshot.publishedHours >= snapshot.requestedDays * 24;
    const reasons: string[] = [];

    if (!ageCoversWindow) {
      reasons.push(
        `Publication age does not cover the requested ${snapshot.requestedDays}-day window.`,
      );
    }

    if (metrics.dataCompleteness < 0.75) {
      reasons.push("Data completeness is below the public demo threshold.");
    }

    if (snapshot.policyFlag) {
      reasons.push("A synthetic policy flag requires the diagnosis to stop.");
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
      reason: reasons.length > 0
        ? reasons.join(" ")
        : "The requested synthetic window passed the public safety gate.",
    };
  },
};

export function checkSafetyGate(snapshot: SyntheticEntitySnapshot): CapabilityCall {
  return checkSafetyGateCapability.run(snapshot);
}
