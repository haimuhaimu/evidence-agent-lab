import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { formatBenchmarkTable, toBenchmarkSnapshot } from "../src/benchmark/report";
import { runBenchmark } from "../src/benchmark/run-benchmark";

const REPORT_PATH = "artifacts/benchmark-run.json";
const SNAPSHOT_PATH = "benchmark/latest.json";
const updateSnapshot = process.argv.includes("--update");

const report = runBenchmark();
const snapshot = toBenchmarkSnapshot(report);
const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
const serializedSnapshot = `${JSON.stringify(snapshot, null, 2)}\n`;

await mkdir(path.dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, serializedReport, "utf8");

let snapshotStatus: "UPDATED" | "PASS" | "STALE" = "PASS";

if (updateSnapshot) {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, serializedSnapshot, "utf8");
  snapshotStatus = "UPDATED";
} else {
  const existingSnapshot = await readFile(SNAPSHOT_PATH, "utf8").catch(() => "");
  if (existingSnapshot !== serializedSnapshot) {
    snapshotStatus = "STALE";
    process.exitCode = 1;
  }
}

console.log(formatBenchmarkTable(report));
console.log(`Full report: ${REPORT_PATH}`);
console.log(`Stable snapshot: ${SNAPSHOT_PATH}`);
console.log(`Snapshot comparison: ${snapshotStatus}`);

if (snapshotStatus === "STALE") {
  console.error("Run `npm run bench:update` to refresh the stable snapshot.");
}
