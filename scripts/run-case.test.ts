import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./run-case.ts", import.meta.url));
const tsxImport = import.meta.resolve("tsx");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function runCaseCli(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", tsxImport, cliPath, ...args],
    { encoding: "utf8" },
  );
}

test("replays a synthetic case as one auditable JSON document", () => {
  const result = runCaseCli([
    "--entity",
    "content_feed_drop",
    "--query",
    "近 7 天为什么掉了",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");

  const output = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(output), [
    "request",
    "decision",
    "primaryEvidence",
    "unknowns",
    "calls",
    "boundary",
  ]);
  assert.deepEqual(output.request, {
    entityId: "content_feed_drop",
    query: "近 7 天为什么掉了",
    days: 7,
    goal: "diagnose",
    clarificationNeeded: [],
  });
  assert.equal(output.decision, "intervene");
  assert.deepEqual(
    output.primaryEvidence.map((item: { id: string }) => item.id),
    ["feed-share-vs-history", "exposure-vs-history", "exposure-vs-peer"],
  );
  assert.deepEqual(output.unknowns, []);
  assert.deepEqual(
    output.calls.map((call: { name: string; status: string }) => [call.name, call.status]),
    [
      ["loadEntitySnapshot", "completed"],
      ["checkSafetyGate", "completed"],
      ["compareHistoricalBaseline", "completed"],
      ["comparePeerBenchmark", "completed"],
      ["attributeSignalDrop", "completed"],
      ["checkDistributionPath", "completed"],
      ["buildEscalationPacket", "completed"],
    ],
  );
  assert.deepEqual(output.boundary, {
    scope: "synthetic_only",
    planner: "deterministic",
    action: "none",
    training: "none",
    delivery: "not_sent",
    causal: "not_claimed",
  });
});

test("fails explicitly for missing, duplicate, empty, or unknown arguments", () => {
  const invalidCases = [
    ["--entity", "content_feed_drop"],
    ["--entity", "", "--query", "近 7 天为什么掉了"],
    [
      "--entity",
      "content_feed_drop",
      "--entity",
      "content_steady",
      "--query",
      "近 7 天为什么掉了",
    ],
    [
      "--entity",
      "content_feed_drop",
      "--query",
      "近 7 天为什么掉了",
      "--format",
      "yaml",
    ],
  ];

  for (const args of invalidCases) {
    const result = runCaseCli(args);

    assert.equal(result.status, 1, args.join(" "));
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^Usage: npm run case -- --entity <synthetic-entity> --query <question>\n$/);
  }
});

test("keeps an evidence refusal as a successful, inspectable replay", () => {
  const result = runCaseCli([
    "--entity",
    "content_missing",
    "--query",
    "近 7 天正常吗",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, "insufficient_evidence");
  assert.deepEqual(
    output.primaryEvidence.map((item: { id: string }) => item.id),
    ["entity-not-found"],
  );
  assert.equal(output.calls.length, 1);
  assert.equal(output.calls[0].status, "blocked");
  assert.ok(output.unknowns.length > 0);
  assert.equal(output.boundary.action, "none");
});

test("exposes the replay through the documented npm command", () => {
  const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
  const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

  assert.equal(packageJson.scripts.case, "tsx scripts/run-case.ts");
  assert.match(
    readFileSync(readmePath, "utf8"),
    /npm run --silent case -- --entity content_feed_drop --query "近 7 天为什么掉了"/,
  );

  const result = spawnSync(
    "npm",
    [
      "run",
      "--silent",
      "case",
      "--",
      "--entity",
      "content_feed_drop",
      "--query",
      "近 7 天为什么掉了",
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(result.stdout).decision, "intervene");
});
