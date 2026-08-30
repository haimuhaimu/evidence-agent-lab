import type { CapabilityCall } from "../core/types";

export type EscalationPacket = {
  entityId: string;
  evidenceIds: string[];
  delivery: "not_sent";
  note: "Demo packet only; no external system was notified.";
  call: CapabilityCall;
};

export function buildEscalationPacket(
  entityId: string,
  evidenceIds: string[],
): EscalationPacket {
  return {
    entityId,
    evidenceIds: [...evidenceIds],
    delivery: "not_sent",
    note: "Demo packet only; no external system was notified.",
    call: {
      name: "buildEscalationPacket",
      status: "completed",
      evidence: [
        {
          id: "escalation-packet",
          capability: "buildEscalationPacket",
          claim: "A local demo packet was structured without notifying an external system.",
          value: "not_sent",
          source: "synthetic",
          confidence: "high",
        },
      ],
      reason: "Built a local structured demo packet with no external delivery action.",
    },
  };
}
