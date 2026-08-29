import assert from "node:assert/strict";
import test from "node:test";
import { runEvidenceAgent } from "../agent/run-agent";
import { buildAgentViewModel } from "./view-model";

test("keeps the first screen to one decision and at most three evidence items", () => {
  const run = runEvidenceAgent({
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
  });
  const view = buildAgentViewModel(run);

  assert.equal(view.decision, "intervene");
  assert.ok(view.primaryEvidence.length <= 3);
  assert.equal(view.traceCount, run.calls.length);
  assert.match(view.disclosure, /deterministic planner/i);
});
