import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";
import path from "node:path";

export type SafetyFinding = {
  path: string;
  rule:
    | "credential-shape"
    | "invalid-binary"
    | "local-path"
    | "internal-source"
    | "real-identity"
    | "unapproved-binary"
    | "unsafe-symlink";
};

const approvedPngDimensions: ReadonlyMap<string, readonly [number, number]> = new Map([
  ["public/evidence-agent-lab-desktop.png", [1440, 900]],
  ["public/evidence-agent-lab-mobile.png", [390, 844]],
] as const);

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
  /(?:^|[^\p{L}\p{N}\p{M}\p{Pc}])\+\d(?:[ .()-]{0,3}\d){7,14}(?![ .()-]{0,3}\d)(?![\p{L}\p{N}\p{M}\p{Pc}])/iu,
  /(?:^|[^\p{L}\p{N}\p{M}\p{Pc}])(?:mobile|phone|tel(?:ephone)?|contact|手机|电话|联系电话)\s*[:=：]\s*(?:\+?86[ -]?)?1[3-9]\d{9}(?![\p{L}\p{N}\p{M}\p{Pc}])/iu,
  /(?:^|[^\p{L}\p{N}\p{M}\p{Pc}])(?:mobile|phone|tel(?:ephone)?|contact|手机|电话|联系电话)\s*[:=：]\s*(?:\(\d{3,4}\)|\d{3})[ .-]\d{3,4}[ .-]\d{4}(?![\p{L}\p{N}\p{M}\p{Pc}])/iu,
];

const classificationSampleBytes = 64 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const localPathOccurrenceAllowances: ReadonlyMap<string, readonly string[]> = new Map([
  ["scripts/public-safety-scan.test.ts", ["%2F", "%25ZZ", "%ZZ", "%E0%A4%A"]],
] as const);

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isValidApprovedPng(
  data: Buffer,
  expectedDimensions: readonly [number, number],
): boolean {
  if (data.length < pngSignature.length + 12 || !data.subarray(0, 8).equals(pngSignature)) {
    return false;
  }

  let offset = 8;
  let chunkIndex = 0;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < data.length) {
    if (offset + 12 > data.length) {
      return false;
    }

    const length = data.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > data.length) {
      return false;
    }

    const typeBytes = data.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type) || !["IHDR", "IDAT", "IEND"].includes(type)) {
      return false;
    }

    const chunkData = data.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = data.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, chunkData])) !== expectedCrc) {
      return false;
    }

    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) {
        return false;
      }
      const [expectedWidth, expectedHeight] = expectedDimensions;
      const width = chunkData.readUInt32BE(0);
      const height = chunkData.readUInt32BE(4);
      const compression = chunkData[10];
      const filtering = chunkData[11];
      const interlace = chunkData[12];
      if (
        width !== expectedWidth
        || height !== expectedHeight
        || compression !== 0
        || filtering !== 0
        || ![0, 1].includes(interlace)
      ) {
        return false;
      }
    } else if (type === "IHDR") {
      return false;
    }

    if (type === "IDAT") {
      if (sawEnd) {
        return false;
      }
      sawImageData = true;
    }

    if (type === "IEND") {
      if (length !== 0 || !sawImageData || chunkEnd !== data.length) {
        return false;
      }
      sawEnd = true;
    } else if (sawEnd) {
      return false;
    }

    chunkIndex += 1;
    offset = chunkEnd;
  }

  return sawEnd;
}

function symlinkEscapesRepository(trackedPath: string, target: string): boolean {
  const normalizedTarget = target.replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(normalizedTarget)
    || path.win32.isAbsolute(target)
    || normalizedTarget.startsWith("//")
  ) {
    return true;
  }

  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(trackedPath), normalizedTarget),
  );
  return resolved === ".." || resolved.startsWith("../");
}

function decodeUrlValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    throw new Error("malformed URL escape");
  }
}

function appendDecodedQueryComponents(
  rawQuery: string,
  decodedValues: string[],
): void {
  for (const parameter of rawQuery.split("&")) {
    const equalsIndex = parameter.indexOf("=");
    if (equalsIndex === -1) {
      decodedValues.push(decodeUrlValue(parameter));
    } else {
      decodedValues.push(
        decodeUrlValue(parameter.slice(0, equalsIndex)),
        decodeUrlValue(parameter.slice(equalsIndex + 1)),
      );
    }
  }
}

function localPathScanContent(content: string): string {
  const decodedValues: string[] = [];
  const contentWithoutWebRoutes = content.replace(
    /\bhttps?:\/\/[^\s"'`<>]+/gi,
    (urlText) => {
      const fragmentIndex = urlText.indexOf("#");
      const queryIndex = urlText.indexOf("?");

      if (queryIndex !== -1 && (fragmentIndex === -1 || queryIndex < fragmentIndex)) {
        const queryEnd = fragmentIndex === -1 ? urlText.length : fragmentIndex;
        const rawQuery = urlText.slice(queryIndex + 1, queryEnd);
        appendDecodedQueryComponents(rawQuery, decodedValues);
      }

      if (fragmentIndex !== -1) {
        const decodedFragment = decodeUrlValue(
          urlText.slice(fragmentIndex + 1),
        );
        if (decodedFragment.startsWith("/")) {
          const routeQueryIndex = decodedFragment.indexOf("?");
          if (routeQueryIndex !== -1) {
            appendDecodedQueryComponents(
              decodedFragment.slice(routeQueryIndex + 1),
              decodedValues,
            );
          }
        } else {
          decodedValues.push(decodedFragment);
        }
      }

      return "";
    },
  );

  return [contentWithoutWebRoutes, ...decodedValues].join("\n");
}

function applyLocalPathOccurrenceAllowances(
  trackedPath: string,
  content: string,
): string {
  const allowedOccurrences = localPathOccurrenceAllowances.get(trackedPath);
  if (!allowedOccurrences) {
    return content;
  }

  return allowedOccurrences.reduce(
    (result, occurrence) => result.replaceAll(
      occurrence,
      occurrence.replaceAll("%", "%2525"),
    ),
    content,
  );
}

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
    const normalizedContent = content.toLowerCase();
    const rules = new Set<SafetyFinding["rule"]>();

    if (credentialShapes.some((shape) => shape.test(content))) {
      rules.add("credential-shape");
    }
    const contentForLocalPathScan = localPathScanContent(
      applyLocalPathOccurrenceAllowances(path, content),
    );
    if (localPathShapes.some((shape) => shape.test(contentForLocalPathScan))) {
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

function loadTrackedContent(): {
  files: Record<string, string>;
  findings: SafetyFinding[];
} {
  const result = spawnSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
    throw new Error("could not list tracked repository files");
  }

  const files: Record<string, string> = {};
  const findings: SafetyFinding[] = [];
  for (const trackedPath of result.stdout.split("\0")) {
    if (trackedPath.length === 0) {
      continue;
    }

    const stat = lstatSync(trackedPath);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(trackedPath, "utf8");
      if (symlinkEscapesRepository(trackedPath, target)) {
        findings.push({ path: trackedPath, rule: "unsafe-symlink" });
      }
      files[trackedPath] = target;
      continue;
    }
    if (!stat.isFile()) {
      throw new Error("tracked path is not a file or symbolic link");
    }

    const data = readFileSync(trackedPath);
    if (isBinaryContent(data)) {
      const expectedDimensions = approvedPngDimensions.get(trackedPath);
      if (expectedDimensions && isValidApprovedPng(data, expectedDimensions)) {
        continue;
      }
      findings.push({
        path: trackedPath,
        rule: expectedDimensions ? "invalid-binary" : "unapproved-binary",
      });
      continue;
    }
    files[trackedPath] = data.toString("utf8");
  }

  return { files, findings };
}

function runCli(): void {
  try {
    const loaded = loadTrackedContent();
    const findings = [...loaded.findings, ...scanTrackedContent(loaded.files)];
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
