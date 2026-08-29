import type {
  CapabilityName,
  ParsedRequest,
  SyntheticEntitySnapshot,
} from "../core/types";

const BASE_CAPABILITIES: CapabilityName[] = [
  "loadEntitySnapshot",
  "checkSafetyGate",
  "compareHistoricalBaseline",
  "comparePeerBenchmark",
  "attributeSignalDrop",
];

export function planCapabilities(
  parsed: ParsedRequest,
  snapshot: SyntheticEntitySnapshot | undefined,
): CapabilityName[] {
  void snapshot;

  return parsed.clarificationNeeded.length > 0 ? [] : [...BASE_CAPABILITIES];
}
