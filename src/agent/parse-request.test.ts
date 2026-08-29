import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentRequest } from "./parse-request";

test("parses a seven-day diagnosis request", () => {
  assert.deepEqual(parseAgentRequest({
    entityId: "content_steady",
    query: "帮我看下近 7 天是不是异常",
  }), {
    entityId: "content_steady",
    query: "帮我看下近 7 天是不是异常",
    days: 7,
    goal: "diagnose",
    clarificationNeeded: [],
  });
});

test("recognizes a scale question", () => {
  assert.equal(parseAgentRequest({ entityId: "content_scale", query: "这条值得追投吗" }).goal, "scale");
});

test("blocks a request without an entity", () => {
  assert.deepEqual(
    parseAgentRequest({ entityId: "", query: "最近一季度流量正常吗" }).clarificationNeeded,
    ["Choose a synthetic content object."],
  );
});

test("maps supported Chinese time windows to days", () => {
  const cases = [
    ["半个月表现如何", 15],
    ["近一季度流量正常吗", 90],
    ["近 42 天数据如何", 42],
    ["最近情况如何", 7],
  ] as const;

  for (const [query, expectedDays] of cases) {
    assert.equal(parseAgentRequest({ entityId: "content_steady", query }).days, expectedDays);
  }
});

test("asks for a valid explicit time window", () => {
  const result = parseAgentRequest({ entityId: "content_steady", query: "近 0 天表现如何" });

  assert.deepEqual(result.clarificationNeeded, ["Use a time window between 1 and 180 days."]);
});
