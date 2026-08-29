import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROJECT_META } from "./project-meta";

test("describes the public project without claiming an LLM planner", () => {
  assert.deepEqual(PROJECT_META, {
    name: "Evidence Agent Lab",
    repository: "evidence-agent-lab",
    planner: "deterministic",
  });
});

test("keeps the Next runtime and ESLint contract on the exact same release", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );

  assert.equal(packageJson.dependencies.next, "16.3.3");
  assert.equal(packageJson.devDependencies["eslint-config-next"], "16.3.3");
});

test("pins GitHub Actions to immutable commits with visible major-version annotations", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/verify.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}\s+# v4/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}\s+# v4/);
  assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v\d/);
});
