import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentRequest } from "./parse-request";
import { planCapabilities } from "./plan-capabilities";

test("plans the five base capabilities in execution order", () => {
  const parsed = parseAgentRequest({
    entityId: "content_steady",
    query: "近 7 天正常吗",
  });

  assert.deepEqual(planCapabilities(parsed, undefined), [
    "loadEntitySnapshot",
    "checkSafetyGate",
    "compareHistoricalBaseline",
    "comparePeerBenchmark",
    "attributeSignalDrop",
  ]);
});

test("plans no capabilities when request clarification is needed", () => {
  const parsed = parseAgentRequest({ entityId: "  ", query: "近 7 天正常吗" });

  assert.deepEqual(planCapabilities(parsed, undefined), []);
});
