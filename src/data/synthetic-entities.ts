import type {
  SyntheticEntityFixture,
  SyntheticWindowMetrics,
} from "../core/types";

type MetricSeed = Omit<SyntheticWindowMetrics, "days" | "exposure" | "historicalExposureMedian" | "peerExposureMedian"> & {
  exposure: number;
  historicalExposureMedian: number;
  peerExposureMedian: number;
};

const WINDOW_FACTORS = [
  [7, 1],
  [15, 2],
  [30, 4],
  [90, 12],
] as const;

function buildWindows(seed: MetricSeed): ReadonlyArray<SyntheticWindowMetrics> {
  return WINDOW_FACTORS.map(([days, factor]) => Object.freeze({
    ...seed,
    days,
    exposure: seed.exposure * factor,
    historicalExposureMedian: seed.historicalExposureMedian * factor,
    peerExposureMedian: seed.peerExposureMedian * factor,
  }));
}

function defineFixture(
  id: string,
  seed: MetricSeed,
): SyntheticEntityFixture {
  return Object.freeze({
    id,
    source: "synthetic" as const,
    publishedHours: 100 * 24,
    policyFlag: false,
    windows: Object.freeze(buildWindows(seed)),
  });
}

function seed(overrides: Partial<MetricSeed> = {}): MetricSeed {
  return {
    dataCompleteness: 1,
    exposure: 10000,
    historicalExposureMedian: 10000,
    peerExposureMedian: 10000,
    clickRate: 0.05,
    peerClickRate: 0.05,
    completionRate: 0.6,
    peerCompletionRate: 0.6,
    feedShare: 0.3,
    historicalFeedShare: 0.3,
    ...overrides,
  };
}

export const SYNTHETIC_ENTITIES: ReadonlyArray<SyntheticEntityFixture> = Object.freeze([
  defineFixture("content_steady", seed()),
  defineFixture("content_scale", seed({
    exposure: 14000,
    clickRate: 0.07,
    completionRate: 0.7,
    feedShare: 0.4,
  })),
  defineFixture("content_click_drop", seed({
    exposure: 6000,
    clickRate: 0.02,
  })),
  defineFixture("content_retention_drop", seed({
    exposure: 7000,
    completionRate: 0.3,
  })),
  defineFixture("content_feed_drop", seed({
    exposure: 7000,
    feedShare: 0.1,
  })),
  defineFixture("content_incomplete", seed({
    dataCompleteness: 0.5,
    exposure: 6000,
  })),
]);

function copyFixture(fixture: SyntheticEntityFixture): SyntheticEntityFixture {
  return Object.freeze({
    ...fixture,
    windows: Object.freeze(fixture.windows.map((window) => Object.freeze({ ...window }))),
  });
}

export function getSyntheticEntity(entityId: string): SyntheticEntityFixture | undefined {
  const fixture = SYNTHETIC_ENTITIES.find((item) => item.id === entityId);
  return fixture ? copyFixture(fixture) : undefined;
}
