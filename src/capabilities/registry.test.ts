import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_REGISTRY } from "./registry";

test("registers exactly the seven public capabilities", () => {
  assert.deepEqual(Object.keys(CAPABILITY_REGISTRY).sort(), [
    "attributeSignalDrop",
    "buildEscalationPacket",
    "checkDistributionPath",
    "checkSafetyGate",
    "compareHistoricalBaseline",
    "comparePeerBenchmark",
    "loadEntitySnapshot",
  ]);
});
