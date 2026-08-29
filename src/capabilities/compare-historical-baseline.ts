import type { Evidence, SyntheticEntitySnapshot } from "../core/types";
import type { Capability, HistoricalComparison } from "./types";

export const compareHistoricalBaselineCapability: Capability<
  SyntheticEntitySnapshot,
  HistoricalComparison
> = {
  name: "compareHistoricalBaseline",
  run(snapshot) {
    const canCompare = snapshot.historicalExposureMedian !== 0
      && Number.isFinite(snapshot.historicalExposureMedian)
      && Number.isFinite(snapshot.exposure);
    const exposureDelta = canCompare
      ? (snapshot.exposure - snapshot.historicalExposureMedian) / snapshot.historicalExposureMedian
      : 0;
    const evidence: Evidence = {
      id: "exposure-vs-history",
      capability: "compareHistoricalBaseline",
      claim: canCompare
        ? "Exposure is compared with its historical median."
        : "Exposure cannot be compared with a zero or non-finite historical median.",
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
          : "A finite, non-zero historical median is required.",
      },
    };
  },
};

export function compareHistoricalBaseline(
  snapshot: SyntheticEntitySnapshot,
): HistoricalComparison {
  return compareHistoricalBaselineCapability.run(snapshot);
}
