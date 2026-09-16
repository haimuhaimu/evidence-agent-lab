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

test("pins Node 24 GitHub Actions releases to their reviewed immutable commits", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/verify.yml", import.meta.url),
    "utf8",
  );

  assert.match(
    workflow,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\s+# v7\.0\.1/,
  );
  assert.match(
    workflow,
    /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020\s+# v7\.0\.0/,
  );
  assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v\d/);
});
