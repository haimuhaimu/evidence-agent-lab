import assert from "node:assert/strict";
import test from "node:test";
import { PROJECT_META } from "./project-meta";

test("describes the public project without claiming an LLM planner", () => {
  assert.deepEqual(PROJECT_META, {
    name: "Evidence Agent Lab",
    repository: "evidence-agent-lab",
    planner: "deterministic",
  });
});
