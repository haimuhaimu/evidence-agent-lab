import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

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
  /\b(?:aws[_-]?secret[_-]?access[_-]?key|secretaccesskey)\b["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{24,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  /\b(?:cookie|set-cookie)\s*:\s*[^\r\n]{8,}/i,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
];

const localPathShapes = [
  /(?:^|[\s"'`=:(])\/(?:Users|home)\/[^/\s"'`<>]+(?:\/|(?=$|[\s"'`<>]))/m,
  /(?:^|[\s"'`=:(])\/root(?:\/|(?=$|[\s"'`<>]))/m,
  /\bfile:\/\/\/(?:Users|home)\/[^/\s"'`<>]+(?:\/|(?=$|[\s"'`<>]))/i,
  /\bfile:\/\/\/root(?:\/|(?=$|[\s"'`<>]))/i,
  /(?:^|[\s"'`=:(])[A-Za-z]:[\\/]Users[\\/][^\\/\s"'`<>]+(?:[\\/]|(?=$|[\s"'`<>]))/im,
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
  /(?:mobile|phone|tel(?:ephone)?|contact|手机|电话|联系电话)\s*[:=：]?\s*\+\d{1,3}(?:[ .-]?\d){7,14}\b/i,
  /(?:mobile|phone|tel(?:ephone)?|contact|手机|电话|联系电话)\s*[:=：]?\s*(?:\+?86[ -]?)?1[3-9]\d{9}\b/i,
  /(?:phone|tel(?:ephone)?|contact|电话|联系电话)\s*[:=：]?\s*\(0\d{2,3}\)[ -]?\d{3,4}[ -]?\d{4}\b/i,
];

const classificationSampleBytes = 64 * 1024;

function isBinaryContent(data: Buffer): boolean {
  const sample = data.subarray(0, classificationSampleBytes);
  if (sample.length === 0) {
    return false;
  }
  if (sample.includes(0)) {
    return true;
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample, {
      stream: data.length > sample.length,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return true;
    }
    throw error;
  }

  let controlBytes = 0;
  for (const byte of sample) {
    if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) {
      controlBytes += 1;
    }
  }

  return controlBytes / sample.length > 0.1;
}

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
    const contentWithoutWebUrls = content.replace(
      /\bhttps?:\/\/[^\s"'`<>]+/gi,
      "",
    );
    if (localPathShapes.some((shape) => shape.test(contentWithoutWebUrls))) {
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

    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      files[path] = readlinkSync(path, "utf8");
      continue;
    }
    if (!stat.isFile()) {
      throw new Error("tracked path is not a file or symbolic link");
    }

    const data = readFileSync(path);
    if (isBinaryContent(data)) {
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
