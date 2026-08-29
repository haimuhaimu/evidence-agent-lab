import type { Evidence } from "../core/types";
import { getSyntheticEntity } from "../data/synthetic-entities";
import type { Capability, SnapshotResult } from "./types";

export const loadEntitySnapshotCapability: Capability<string, SnapshotResult> = {
  name: "loadEntitySnapshot",
  run(entityId) {
    const declaredSnapshot = getSyntheticEntity(entityId);
    const snapshot = declaredSnapshot
      ? Object.freeze({ ...declaredSnapshot })
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

export function loadEntitySnapshot(entityId: string): SnapshotResult {
  return loadEntitySnapshotCapability.run(entityId);
}
