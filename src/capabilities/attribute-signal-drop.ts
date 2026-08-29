import type { CapabilityCall } from "../core/types";
import type { HistoricalComparison, PeerComparison } from "./types";

export type SignalAttribution = {
  primarySignal: "click_rate" | "completion_rate" | "none";
  explainsExposureDrop: boolean;
  call: CapabilityCall;
};

export type SignalAttributionInput = {
  historical: HistoricalComparison;
  peer: PeerComparison;
};

export function attributeSignalDrop({
  historical,
  peer,
}: SignalAttributionInput): SignalAttribution {
  const blocked = historical.call.status !== "completed" || peer.call.status !== "completed";
  const primarySignal = !blocked && (peer.clickRateDelta < -0.15 || peer.completionRateDelta < -0.15)
    ? peer.clickRateDelta <= peer.completionRateDelta
      ? "click_rate"
      : "completion_rate"
    : "none";
  const explainsExposureDrop = primarySignal !== "none" && historical.exposureDelta <= -0.2;

  return {
    primarySignal,
    explainsExposureDrop,
    call: {
      name: "attributeSignalDrop",
      status: blocked ? "blocked" : "completed",
      evidence: [
        {
          id: "primary-signal",
          capability: "attributeSignalDrop",
          claim: blocked
            ? "The observed synthetic metrics could not all be compared with valid baselines."
            : "The primary signal classifies observed peer deltas without making a causal claim.",
          value: primarySignal,
          source: "synthetic",
          confidence: blocked ? "low" : "high",
        },
      ],
      reason: blocked
        ? "Finite synthetic baseline and peer metrics are required for complete attribution."
        : "Classified the largest observed negative peer signal below the demo threshold.",
    },
  };
}
