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
  link?: unknown;
  resolved?: unknown;
};

type ResolvedLockfilePackage = {
  path: string;
  value: LockfilePackage;
  dev: boolean;
};

const baseAcceptedLicenseExpressions = new Set([
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

const verifiedLibvipsPackages = new Set([
  "@img/sharp-libvips-darwin-arm64",
  "@img/sharp-libvips-darwin-x64",
  "@img/sharp-libvips-linux-arm",
  "@img/sharp-libvips-linux-arm64",
  "@img/sharp-libvips-linux-ppc64",
  "@img/sharp-libvips-linux-riscv64",
  "@img/sharp-libvips-linux-s390x",
  "@img/sharp-libvips-linux-x64",
  "@img/sharp-libvips-linuxmusl-arm64",
  "@img/sharp-libvips-linuxmusl-x64",
]);

const verifiedSharpWin32Packages = new Set([
  "@img/sharp-win32-arm64",
  "@img/sharp-win32-ia32",
  "@img/sharp-win32-x64",
]);

function isVerifiedDependencyLicense(
  packageName: string,
  version: string,
  license: string,
): boolean {
  return (
    (packageName === "caniuse-lite" &&
      version === "1.0.30001810" &&
      license === "CC-BY-4.0") ||
    (verifiedLibvipsPackages.has(packageName) &&
      version === "1.3.3" &&
      license === "LGPL-3.0-or-later") ||
    (verifiedSharpWin32Packages.has(packageName) &&
      version === "0.35.4" &&
      license === "Apache-2.0 AND LGPL-3.0-or-later") ||
    (packageName === "@img/sharp-wasm32" &&
      version === "0.35.4" &&
      license === "Apache-2.0 AND LGPL-3.0-or-later AND MIT")
  );
}

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

function isSafeLinkTarget(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    path.includes("\\")
  ) {
    return false;
  }

  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function resolveLockfileLink(
  packages: Record<string, unknown>,
  startPath: string,
  linkedTargets: Set<string>,
): ResolvedLockfilePackage {
  const visited = new Set<string>();
  let currentPath = startPath;
  let dev = false;

  while (true) {
    if (visited.has(currentPath)) {
      throw new Error("lockfile link cycle detected");
    }
    visited.add(currentPath);

    if (!Object.hasOwn(packages, currentPath)) {
      throw new Error("lockfile link target is absent");
    }
    const rawPackage = packages[currentPath];
    if (!isRecord(rawPackage)) {
      throw new Error("lockfile link target metadata is invalid");
    }
    const lockPackage: LockfilePackage = rawPackage;
    dev ||= lockPackage.dev === true;

    if (lockPackage.link === undefined || lockPackage.link === false) {
      return { path: currentPath, value: lockPackage, dev };
    }
    if (lockPackage.link !== true || typeof lockPackage.resolved !== "string") {
      throw new Error("lockfile link metadata is invalid");
    }
    if (!isSafeLinkTarget(lockPackage.resolved)) {
      throw new Error("lockfile link target escapes the lockfile");
    }

    linkedTargets.add(lockPackage.resolved);
    currentPath = lockPackage.resolved;
  }
}

export function scanDependencyLicenses(lockfile: unknown): LicenseFinding[] {
  if (!isRecord(lockfile) || !isRecord(lockfile.packages)) {
    throw new Error("lockfile packages are required");
  }

  const packages = lockfile.packages;
  const linkedTargets = new Set<string>();
  const resolvedLinks = new Map<string, ResolvedLockfilePackage>();
  for (const [path, rawPackage] of Object.entries(packages)) {
    if (!isRecord(rawPackage)) {
      throw new Error("lockfile package metadata is invalid");
    }
    if (rawPackage.link !== undefined && rawPackage.link !== true) {
      throw new Error("lockfile link metadata is invalid");
    }
    if (rawPackage.link === true) {
      resolvedLinks.set(
        path,
        resolveLockfileLink(packages, path, linkedTargets),
      );
    }
  }

  const findings: LicenseFinding[] = [];
  const scannedPackages = new Set<string>();
  for (const [path, rawPackage] of Object.entries(packages)) {
    if (path === "") {
      continue;
    }
    if (!isRecord(rawPackage)) {
      throw new Error("lockfile package metadata is invalid");
    }

    const originalPackage: LockfilePackage = rawPackage;
    if (linkedTargets.has(path) && originalPackage.link !== true) {
      continue;
    }

    const resolvedPackage = resolvedLinks.get(path) ?? {
      path,
      value: originalPackage,
      dev: originalPackage.dev === true,
    };
    if (resolvedPackage.dev || scannedPackages.has(resolvedPackage.path)) {
      continue;
    }
    scannedPackages.add(resolvedPackage.path);

    const lockPackage = resolvedPackage.value;

    const packageName =
      typeof lockPackage.name === "string" && lockPackage.name.length > 0
        ? lockPackage.name
        : packageNameFromPath(resolvedPackage.path);
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

    if (
      baseAcceptedLicenseExpressions.has(license) ||
      isVerifiedDependencyLicense(packageName, version, license)
    ) {
      continue;
    }

    findings.push({
      packageName,
      version,
      license,
      rule: "denied-license",
    });
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
