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

  assert.deepEqual(result.clarificationNeeded, ["Use a whole-number time window between 1 and 180 days."]);
});

test("rejects every explicit malformed or unsafe numeric time window", () => {
  const queries = [
    "近 -1 天表现如何",
    "近 1.5 天表现如何",
    "近 abc 天表现如何",
    "近 999999999999999999999 天表现如何",
  ];

  for (const query of queries) {
    const result = parseAgentRequest({ entityId: "content_steady", query });

    assert.deepEqual(
      result.clarificationNeeded,
      ["Use a whole-number time window between 1 and 180 days."],
      query,
    );
  }
});

test("asks for one window instead of choosing among conflicting windows", () => {
  for (const query of [
    "近 7 天和近 30 天正常吗",
    "近 30 天和近 7 天正常吗",
    "半个月和近一季度正常吗",
    "近 7 天和半个月正常吗",
    "近半个月和近7天正常吗",
  ]) {
    const result = parseAgentRequest({ entityId: "content_steady", query });
    assert.deepEqual(result.clarificationNeeded, ["Choose one time window per request."], query);
  }
});

test("validates later numeric windows even when the first one is valid", () => {
  for (const query of [
    "近 7 天和近 0 天正常吗",
    "近 7 天和近 -1 天正常吗",
    "近 7 天和近 1.5 天正常吗",
    "近 7 天和近 abc 天正常吗",
    "近 7 天和近 181 天正常吗",
    "近 7 天和近 999999999999999999999 天正常吗",
  ]) {
    const result = parseAgentRequest({ entityId: "content_steady", query });
    assert.deepEqual(result.clarificationNeeded,
      ["Use a whole-number time window between 1 and 180 days."], query);
  }
});

test("accepts repeated equivalent windows without inventing a conflict", () => {
  for (const [query, days] of [
    ["近 7 天，也就是近 7 天的表现", 7],
    ["半个月，也就是近 15 天正常吗", 15],
    ["近一季度，也就是近 90 天正常吗", 90],
    ["近半个月，也就是近15天正常吗", 15],
    ["近一季度，也就是近90天正常吗", 90],
  ] as const) {
    const result = parseAgentRequest({ entityId: "content_steady", query });
    assert.equal(result.days, days, query);
    assert.deepEqual(result.clarificationNeeded, [], query);
  }
});
