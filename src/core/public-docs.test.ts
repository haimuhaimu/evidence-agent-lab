import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("README shows the generated benchmark and honest boundaries", async () => {
  const readme = await readFile(new URL("../../README.md", import.meta.url), "utf8");
  const report = JSON.parse(
    await readFile(new URL("../../benchmark/latest.json", import.meta.url), "utf8"),
  );

  assert.match(
    readme,
    new RegExp(`Audit Pass Rate:\\s+${report.passedCaseCount}/${report.caseCount}`),
  );
  assert.match(readme, /deterministic planner/i);
  assert.match(readme, /synthetic data/i);
  assert.match(readme, /No production action/i);
});
