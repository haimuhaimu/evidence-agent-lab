import type { Evidence } from "../core/types";
import { getSyntheticEntity } from "../data/synthetic-entities";
import type { Capability, SnapshotRequest, SnapshotResult } from "./types";

export const loadEntitySnapshotCapability: Capability<SnapshotRequest, SnapshotResult> = {
  name: "loadEntitySnapshot",
  run({ entityId, days }) {
    const declaredSnapshot = getSyntheticEntity(entityId);
    const snapshot = declaredSnapshot
      ? Object.freeze({
          id: declaredSnapshot.id,
          source: declaredSnapshot.source,
          publishedHours: declaredSnapshot.publishedHours,
          policyFlag: declaredSnapshot.policyFlag,
          requestedDays: days,
          metrics: declaredSnapshot.windows.find((window) => window.days === days) ?? null,
        })
      : undefined;
    const evidence: Evidence = snapshot
      ? {
          id: "entity-snapshot",
          capability: "loadEntitySnapshot",
          claim: "The entity is a declared synthetic snapshot.",
          value: snapshot.id,
          source: "synthetic",
          confidence: "high",
        }
      : {
          id: "entity-not-found",
          capability: "loadEntitySnapshot",
          claim: "The entity is not present in the declared synthetic dataset.",
          value: entityId,
          source: "synthetic",
          confidence: "high",
        };
    const status = snapshot ? "completed" : "blocked";

    return {
      status,
      snapshot,
      call: {
        name: "loadEntitySnapshot",
        status,
        evidence: [evidence],
        reason: snapshot
          ? "Loaded a declared synthetic entity snapshot."
          : "Only declared synthetic entity snapshots can be loaded.",
      },
    };
  },
};

export function loadEntitySnapshot(input: SnapshotRequest): SnapshotResult {
  return loadEntitySnapshotCapability.run(input);
}
