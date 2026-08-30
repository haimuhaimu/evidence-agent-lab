import type { CapabilityCall, SyntheticEntitySnapshot } from "../core/types";
import type { SignalAttribution } from "./attribute-signal-drop";

export type DistributionCheck = {
  status: "not_needed" | "watch" | "risk";
  feedShareDelta: number;
  call: CapabilityCall;
};

type AttributionSummary = Pick<SignalAttribution, "primarySignal" | "explainsExposureDrop">;

export function checkDistributionPath(
  snapshot: SyntheticEntitySnapshot,
  attribution: AttributionSummary,
): DistributionCheck {
  if (attribution.explainsExposureDrop) {
    return {
      status: "not_needed",
      feedShareDelta: 0,
      call: {
        name: "checkDistributionPath",
        status: "skipped",
        evidence: [
          {
            id: "feed-share-vs-history",
            capability: "checkDistributionPath",
            claim: "The synthetic Feed-share comparison was skipped after observed-signal attribution.",
            value: 0,
            source: "synthetic",
            confidence: "high",
          },
        ],
        reason: "A distribution comparison was not needed after the observed attribution branch.",
      },
    };
  }

  const metrics = snapshot.metrics;
  const canCompare = metrics !== null
    && metrics.historicalFeedShare !== 0
    && Number.isFinite(metrics.historicalFeedShare)
    && Number.isFinite(metrics.feedShare);
  const feedShareDelta = canCompare
    ? (metrics!.feedShare - metrics!.historicalFeedShare) / metrics!.historicalFeedShare
    : 0;
  const status = feedShareDelta <= -0.2 ? "risk" : "watch";

  return {
    status,
    feedShareDelta,
    call: {
      name: "checkDistributionPath",
      status: canCompare ? "completed" : "blocked",
      evidence: [
        {
          id: "feed-share-vs-history",
          capability: "checkDistributionPath",
          claim: canCompare
            ? "Synthetic Feed share is compared with its synthetic historical baseline."
            : "Synthetic Feed share cannot be compared when the current value or historical baseline is invalid.",
          value: feedShareDelta,
          source: "synthetic",
          confidence: canCompare ? "high" : "low",
        },
      ],
      reason: canCompare
        ? "Classified the synthetic Feed-share delta using the demo threshold."
        : "Finite Feed-share values and a non-zero synthetic historical baseline are required.",
    },
  };
}
