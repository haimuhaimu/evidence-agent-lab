import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type LicenseFinding = {
  packageName: string;
  version: string;
  license: string;
  rule: "denied-license" | "missing-license";
};

type LockfilePackage = {
  name?: unknown;
  version?: unknown;
  dev?: unknown;
  license?: unknown;
};

const allowedLicenses = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Unlicense",
]);

const deniedLicenseShapes = [
  /(?:^|[^A-Z])(?:GPL|AGPL)(?:[^A-Z]|$)/,
  /(?:^|[^A-Z])SSPL(?:[^A-Z]|$)/,
  /(?:^|[^A-Z])BUSL(?:[^A-Z]|$)/,
  /COMMONS[- ]CLAUSE/,
  /POLYFORM(?:-|$)/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function packageNameFromPath(path: string): string {
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  return index === -1 ? path : path.slice(index + marker.length);
}

function normalizeLicense(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length === 0 ? undefined : normalized;
}

export function scanDependencyLicenses(lockfile: unknown): LicenseFinding[] {
  if (!isRecord(lockfile) || !isRecord(lockfile.packages)) {
    throw new Error("lockfile packages are required");
  }

  const findings: LicenseFinding[] = [];
  for (const [path, rawPackage] of Object.entries(lockfile.packages)) {
    if (path === "") {
      continue;
    }
    if (!isRecord(rawPackage)) {
      throw new Error("lockfile package metadata is invalid");
    }

    const lockPackage: LockfilePackage = rawPackage;
    if (lockPackage.dev === true) {
      continue;
    }

    const packageName =
      typeof lockPackage.name === "string" && lockPackage.name.length > 0
        ? lockPackage.name
        : packageNameFromPath(path);
    const version =
      typeof lockPackage.version === "string" && lockPackage.version.length > 0
        ? lockPackage.version
        : "UNKNOWN";
    const license = normalizeLicense(lockPackage.license);

    if (!license) {
      findings.push({
        packageName,
        version,
        license: "UNKNOWN",
        rule: "missing-license",
      });
      continue;
    }

    if (allowedLicenses.has(license)) {
      continue;
    }

    const uppercaseLicense = license.toUpperCase();
    if (deniedLicenseShapes.some((shape) => shape.test(uppercaseLicense))) {
      findings.push({
        packageName,
        version,
        license,
        rule: "denied-license",
      });
    }
  }

  return findings;
}

function runCli(): void {
  try {
    const lockfile: unknown = JSON.parse(
      readFileSync("package-lock.json", "utf8"),
    );
    const findings = scanDependencyLicenses(lockfile);
    if (findings.length === 0) {
      console.log("0 dependency-license findings");
      return;
    }

    for (const finding of findings) {
      console.error(
        `${finding.packageName}@${finding.version}\t${finding.license}\t${finding.rule}`,
      );
    }
    console.error(`${findings.length} dependency-license findings`);
    process.exitCode = 1;
  } catch {
    console.error("dependency-license scan failed");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli();
}
