import type { Evidence, SyntheticEntitySnapshot } from "../core/types";
import type { Capability, HistoricalComparison } from "./types";

export const compareHistoricalBaselineCapability: Capability<
  SyntheticEntitySnapshot,
  HistoricalComparison
> = {
  name: "compareHistoricalBaseline",
  run(snapshot) {
    const metrics = snapshot.metrics;
    const canCompare = metrics !== null
      && metrics.historicalExposureMedian !== 0
      && Number.isFinite(metrics.historicalExposureMedian)
      && Number.isFinite(metrics.exposure);
    const exposureDelta = canCompare
      ? (metrics!.exposure - metrics!.historicalExposureMedian) / metrics!.historicalExposureMedian
      : 0;
    const evidence: Evidence = {
      id: "exposure-vs-history",
      capability: "compareHistoricalBaseline",
      claim: canCompare
        ? "Exposure is compared with its historical median."
        : "Exposure cannot be compared when the current exposure or historical median is invalid.",
      value: exposureDelta,
      source: "synthetic",
      confidence: canCompare ? "high" : "low",
    };

    return {
      exposureDelta,
      call: {
        name: "compareHistoricalBaseline",
        status: canCompare ? "completed" : "blocked",
        evidence: [evidence],
        reason: canCompare
          ? "Computed the exposure delta from the historical median."
          : "Finite current exposure and historical median values, with a non-zero median, are required.",
      },
    };
  },
};

export function compareHistoricalBaseline(
  snapshot: SyntheticEntitySnapshot,
): HistoricalComparison {
  return compareHistoricalBaselineCapability.run(snapshot);
}
