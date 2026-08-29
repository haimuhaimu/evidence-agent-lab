import type {
  CapabilityCall,
  CapabilityName,
  SyntheticEntitySnapshot,
} from "../core/types";

export type Capability<I, O> = {
  name: CapabilityName;
  run(input: I): O;
};

export type SnapshotResult = {
  status: "completed" | "blocked";
  snapshot?: SyntheticEntitySnapshot;
  call: CapabilityCall;
};

export type SnapshotRequest = {
  entityId: string;
  days: number;
};

export type HistoricalComparison = {
  exposureDelta: number;
  call: CapabilityCall;
};

export type PeerComparison = {
  exposureDelta: number;
  clickRateDelta: number;
  completionRateDelta: number;
  call: CapabilityCall;
};
