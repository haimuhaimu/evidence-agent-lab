import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export type SafetyFinding = {
  path: string;
  rule:
    | "credential-shape"
    | "local-path"
    | "internal-source"
    | "real-identity";
};

const excludedPaths = new Set([
  "scripts/public-safety-scan.ts",
  "scripts/public-safety-scan.test.ts",
  "docs/privacy.md",
]);

const credentialShapes = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\baws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9/+=]{32,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:cookie|set-cookie)\s*:\s*[^\r\n]{8,}/i,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
];

const localPathShapes = [
  /\/(?:Users|home)\/[^/\s]+(?:\/|\b)/,
  /\/root(?:\/|\b)/,
  /\b[A-Za-z]:\\Users\\[^\\\s]+(?:\\|\b)/i,
];

const internalSourceMarkers = [
  ["source:", "lark"].join(""),
  ["source:", "feishu"].join(""),
  ["source:", "internal-"].join(""),
  ["byte", "dance"].join(""),
  ["traffic-", "diagnosis-agent"].join(""),
];

const realIdentityShapes = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\+\d{1,3}(?:[ .-]?\d){7,14}\b/,
];

export function scanTrackedContent(
  files: Readonly<Record<string, string>>,
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (excludedPaths.has(path)) {
      continue;
    }

    const normalizedContent = content.toLowerCase();
    const rules = new Set<SafetyFinding["rule"]>();

    if (credentialShapes.some((shape) => shape.test(content))) {
      rules.add("credential-shape");
    }
    if (localPathShapes.some((shape) => shape.test(content))) {
      rules.add("local-path");
    }
    if (internalSourceMarkers.some((marker) => normalizedContent.includes(marker))) {
      rules.add("internal-source");
    }
    if (realIdentityShapes.some((shape) => shape.test(content))) {
      rules.add("real-identity");
    }

    for (const rule of rules) {
      findings.push({ path, rule });
    }
  }

  return findings;
}

function loadTrackedTextFiles(): Record<string, string> {
  const result = spawnSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
    throw new Error("could not list tracked repository files");
  }

  const files: Record<string, string> = {};
  for (const path of result.stdout.split("\0")) {
    if (path.length === 0 || excludedPaths.has(path)) {
      continue;
    }

    const data = readFileSync(path);
    if (data.includes(0)) {
      continue;
    }
    files[path] = data.toString("utf8");
  }

  return files;
}

function runCli(): void {
  try {
    const findings = scanTrackedContent(loadTrackedTextFiles());
    if (findings.length === 0) {
      console.log("0 public-safety findings");
      return;
    }

    for (const finding of findings) {
      console.error(`${finding.path}\t${finding.rule}`);
    }
    console.error(`${findings.length} public-safety findings`);
    process.exitCode = 1;
  } catch {
    console.error("public-safety scan failed");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli();
}
