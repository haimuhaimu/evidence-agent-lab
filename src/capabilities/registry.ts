import { attributeSignalDrop } from "./attribute-signal-drop";
import { buildEscalationPacket } from "./build-escalation-packet";
import { checkDistributionPath } from "./check-distribution-path";
import { checkSafetyGate } from "./check-safety-gate";
import { compareHistoricalBaseline } from "./compare-historical-baseline";
import { comparePeerBenchmark } from "./compare-peer-benchmark";
import { loadEntitySnapshot } from "./load-entity-snapshot";

export const CAPABILITY_REGISTRY = {
  loadEntitySnapshot,
  checkSafetyGate,
  compareHistoricalBaseline,
  comparePeerBenchmark,
  attributeSignalDrop,
  checkDistributionPath,
  buildEscalationPacket,
} as const;
