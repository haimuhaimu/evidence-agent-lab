import type { Evidence, SyntheticEntitySnapshot } from "../core/types";
import type { Capability, PeerComparison } from "./types";

type MetricComparison = {
  delta: number;
  evidence: Evidence;
  blocked: boolean;
};

function compareMetric(
  id: "exposure-vs-peer" | "click-rate-vs-peer" | "completion-rate-vs-peer",
  current: number,
  peerMedian: number,
): MetricComparison {
  const canCompare = peerMedian !== 0 && Number.isFinite(peerMedian) && Number.isFinite(current);
  const delta = canCompare ? (current - peerMedian) / peerMedian : 0;

  return {
    delta,
    blocked: !canCompare,
    evidence: {
      id,
      capability: "comparePeerBenchmark",
      claim: canCompare
        ? "The current metric is compared with its peer median."
        : "The metric cannot be compared with a zero or non-finite peer median.",
      value: delta,
      source: "synthetic",
      confidence: canCompare ? "high" : "low",
    },
  };
}

export const comparePeerBenchmarkCapability: Capability<SyntheticEntitySnapshot, PeerComparison> = {
  name: "comparePeerBenchmark",
  run(snapshot) {
    const exposure = compareMetric("exposure-vs-peer", snapshot.exposure, snapshot.peerExposureMedian);
    const clickRate = compareMetric("click-rate-vs-peer", snapshot.clickRate, snapshot.peerClickRate);
    const completionRate = compareMetric(
      "completion-rate-vs-peer",
      snapshot.completionRate,
      snapshot.peerCompletionRate,
    );
    const comparisons = [exposure, clickRate, completionRate];
    const blocked = comparisons.some((comparison) => comparison.blocked);

    return {
      exposureDelta: exposure.delta,
      clickRateDelta: clickRate.delta,
      completionRateDelta: completionRate.delta,
      call: {
        name: "comparePeerBenchmark",
        status: blocked ? "blocked" : "completed",
        evidence: comparisons.map((comparison) => comparison.evidence),
        reason: blocked
          ? "Finite, non-zero peer medians are required for every comparison."
          : "Computed exposure, click-rate, and completion-rate peer deltas.",
      },
    };
  },
};

export function comparePeerBenchmark(snapshot: SyntheticEntitySnapshot): PeerComparison {
  return comparePeerBenchmarkCapability.run(snapshot);
}
