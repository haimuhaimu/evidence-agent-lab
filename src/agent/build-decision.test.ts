import assert from "node:assert/strict";
import test from "node:test";
import { buildDecision, type DecisionContext } from "./build-decision";

const HEALTHY_CONTEXT: DecisionContext = {
  blocked: false,
  unknowns: [],
  policyFlag: false,
  attributedRisk: false,
  distributionRisk: false,
  goal: "diagnose",
  exposureDelta: 0.1,
  clickPeerDelta: 0,
  completionPeerDelta: 0,
};

test("returns insufficient evidence before every other decision", () => {
  assert.equal(buildDecision({
    ...HEALTHY_CONTEXT,
    blocked: true,
    policyFlag: true,
    goal: "scale",
  }), "insufficient_evidence");
  assert.equal(buildDecision({
    ...HEALTHY_CONTEXT,
    unknowns: ["Missing comparison."],
    attributedRisk: true,
  }), "insufficient_evidence");
});

test("intervenes for each declared risk signal", () => {
  assert.equal(buildDecision({ ...HEALTHY_CONTEXT, policyFlag: true }), "intervene");
  assert.equal(buildDecision({ ...HEALTHY_CONTEXT, attributedRisk: true }), "intervene");
  assert.equal(buildDecision({ ...HEALTHY_CONTEXT, distributionRisk: true }), "intervene");
});

test("scales only healthy scale intent at the exact boundaries", () => {
  assert.equal(buildDecision({ ...HEALTHY_CONTEXT, goal: "scale" }), "scale");
  assert.equal(buildDecision({
    ...HEALTHY_CONTEXT,
    goal: "scale",
    exposureDelta: 0.099,
  }), "expected");
  assert.equal(buildDecision({
    ...HEALTHY_CONTEXT,
    goal: "scale",
    clickPeerDelta: -0.001,
  }), "expected");
  assert.equal(buildDecision({
    ...HEALTHY_CONTEXT,
    goal: "scale",
    completionPeerDelta: -0.001,
  }), "expected");
});

test("keeps the same healthy evidence expected without scale intent", () => {
  assert.equal(buildDecision(HEALTHY_CONTEXT), "expected");
});
