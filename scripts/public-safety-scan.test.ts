import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { scanTrackedContent } from "./public-safety-scan";

const scannerPath = fileURLToPath(new URL("./public-safety-scan.ts", import.meta.url));
const tsxImport = import.meta.resolve("tsx");

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function runSafetyCli(cwd: string) {
  return spawnSync(
    process.execPath,
    ["--import", tsxImport, scannerPath],
    { cwd, encoding: "utf8" },
  );
}

test("reports paths but never matched credential text", () => {
  const findings = scanTrackedContent({
    "src/example.ts":
      "const token = '" + "ghp_" + "abcdefghijklmnopqrstuvwxyz123456';",
  });

  assert.deepEqual(
    findings.map((item) => item.path),
    ["src/example.ts"],
  );
  assert.equal(
    JSON.stringify(findings).includes("abcdefghijklmnopqrstuvwxyz123456"),
    false,
  );
});

test("rejects local absolute paths and internal-source markers", () => {
  const findings = scanTrackedContent({
    "README.md":
      "/" + "Users/example/private and source:" + "internal-fixture",
  });

  assert.deepEqual(
    findings.map((item) => item.rule).sort(),
    ["internal-source", "local-path"],
  );
});

test("detects common synthetic credential shapes", () => {
  const files = {
    "fixtures/openai.txt": "sk-" + "synthetic_example_token_123456",
    "fixtures/aws.txt": "AKIA" + "EXAMPLEEXAMPLE12",
    "fixtures/private-key.txt": "-----BEGIN " + "PRIVATE KEY-----",
    "fixtures/cookie.txt":
      ["Coo", "kie: session_id=", "synthetic-cookie-value-123456"].join(""),
    "fixtures/bearer.txt":
      "Authorization: Bearer " + "synthetic.bearer.token.123456",
  };

  const findings = scanTrackedContent(files);

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    Object.keys(files).sort(),
  );
  assert.ok(findings.every((item) => item.rule === "credential-shape"));
});

test("detects encrypted keys and SecretAccessKey API spellings", () => {
  const files = {
    "fixtures/encrypted-key.txt":
      "-----BEGIN " + "ENCRYPTED PRIVATE KEY-----",
    "fixtures/api-secret.json":
      '"Secret' +
      'AccessKey": "' +
      "syntheticAccessKeyMaterial1234567890" +
      '"',
  };

  const findings = scanTrackedContent(files);

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    Object.keys(files).sort(),
  );
  assert.ok(findings.every((item) => item.rule === "credential-shape"));
});

test("detects macOS, Linux, and Windows user directories", () => {
  const findings = scanTrackedContent({
    "fixtures/macos.txt": "/" + "Users/example/work/item.txt",
    "fixtures/linux.txt": "/" + "home/example/work/item.txt",
    "fixtures/linux-root.txt": "/" + "root/private/item.txt",
    "fixtures/windows.txt": "C:" + "\\Users\\example\\work\\item.txt",
    "fixtures/windows-slashes.txt": "C:" + "/" + "Users/example/work/item.txt",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/linux-root.txt",
      "fixtures/linux.txt",
      "fixtures/macos.txt",
      "fixtures/windows-slashes.txt",
      "fixtures/windows.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "local-path"));
});

test("does not confuse ordinary web routes with credible local paths", () => {
  const findings = scanTrackedContent({
    "fixtures/macos-path.txt": "open /" + "Users/example/work/item.txt",
    "fixtures/linux-path.txt": "cd /" + "home/example/work/item.txt",
    "fixtures/root-path.txt": "file:///" + "root/private/item.txt",
    "fixtures/users-route.txt":
      "https://example.invalid/" + "Users/example/profile",
    "fixtures/home-route.txt":
      "https://example.invalid/" + "home/example/guide",
    "fixtures/root-route.txt":
      "https://example.invalid/" + "root/admin/guide",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/linux-path.txt",
      "fixtures/macos-path.txt",
      "fixtures/root-path.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "local-path"));
});

test("scans decoded URL query and fragment values but not route segments", () => {
  const findings = scanTrackedContent({
    "fixtures/route-home.txt": "https://example.invalid/home/docs",
    "fixtures/route-users.txt": "https://example.invalid/Users/docs",
    "fixtures/route-root.txt": "https://example.invalid/root/docs",
    "fixtures/raw-query.txt":
      "https://example.invalid/docs?file=/" + "Users/example/private",
    "fixtures/encoded-query.txt":
      "https://example.invalid/docs?path=%2Fhome%2Fexample%2Fprivate",
    "fixtures/nested-file-query.txt":
      "https://example.invalid/docs?next=file%3A%2F%2F%2FUsers%2Fexample%2Fprivate",
    "fixtures/raw-fragment.txt":
      "https://example.invalid/docs#file:///" + "home/example/private",
    "fixtures/encoded-fragment.txt":
      "https://example.invalid/docs#path=file%3A%2F%2F%2Froot%2Fprivate",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/encoded-fragment.txt",
      "fixtures/encoded-query.txt",
      "fixtures/nested-file-query.txt",
      "fixtures/raw-fragment.txt",
      "fixtures/raw-query.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "local-path"));
});

test("fails closed on malformed URL parameter or fragment escapes", () => {
  const malformedContents = [
    "https://example.invalid/docs?file=%E0%A4%A",
    "https://example.invalid/docs?%ZZ=value",
    "https://example.invalid/docs?%E0%A4%A",
    "https://example.invalid/docs#path=%ZZ%2FUsers%2Fexample",
  ];

  for (const content of malformedContents) {
    assert.throws(
      () => scanTrackedContent({ "fixtures/malformed-url.txt": content }),
      /malformed URL escape/,
    );
  }
});

test("scans decoded bare query components and query keys", () => {
  const findings = scanTrackedContent({
    "fixtures/path-key.txt":
      "https://example.invalid/docs?%2FUsers%2Fexample%2Fprivate=ok",
    "fixtures/bare-path.txt":
      "https://example.invalid/docs?%2Fhome%2Fexample%2Fprivate",
    "fixtures/bare-file.txt":
      "https://example.invalid/docs?file%3A%2F%2F%2Froot%2Fprivate",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/bare-file.txt",
      "fixtures/bare-path.txt",
      "fixtures/path-key.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "local-path"));
});

test("ignores hash-router routes but scans explicit fragment data", () => {
  const findings = scanTrackedContent({
    "fixtures/raw-home-route.txt": "https://example.invalid/#/home/docs",
    "fixtures/raw-users-route.txt": "https://example.invalid/#/Users/docs",
    "fixtures/encoded-root-route.txt":
      "https://example.invalid/#%2Froot%2Fdocs",
    "fixtures/fragment-path.txt":
      "https://example.invalid/#path=/" + "Users/example/private",
    "fixtures/encoded-fragment-path.txt":
      "https://example.invalid/#path%3D%2Fhome%2Fexample%2Fprivate",
    "fixtures/fragment-file.txt":
      "https://example.invalid/#file:///" + "root/private",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/encoded-fragment-path.txt",
      "fixtures/fragment-file.txt",
      "fixtures/fragment-path.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "local-path"));
});

test("scans complete hash-route queries but ignores route pathnames", () => {
  const findings = scanTrackedContent({
    "fixtures/raw-route-query-path.txt":
      "https://example.invalid/#/docs?path=/" + "Users/example/private",
    "fixtures/encoded-route-query-path.txt":
      "https://example.invalid/#%2Fdocs%3Fpath%3D%2FUsers%2Fexample%2Fprivate",
    "fixtures/raw-route-query-file.txt":
      "https://example.invalid/#/docs?next=file:///" + "home/example/private",
    "fixtures/encoded-route-query-file.txt":
      "https://example.invalid/#%2Fdocs%3Fnext%3Dfile%3A%2F%2F%2Fhome%2Fexample%2Fprivate",
    "fixtures/raw-route-only.txt":
      "https://example.invalid/#/Users/example/private",
    "fixtures/encoded-route-only.txt":
      "https://example.invalid/#%2Fhome%2Fexample%2Fprivate",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/encoded-route-query-file.txt",
      "fixtures/encoded-route-query-path.txt",
      "fixtures/raw-route-query-file.txt",
      "fixtures/raw-route-query-path.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "local-path"));
});

test("fails closed generically on malformed hash-route query escapes", () => {
  const malformedContents = [
    "https://example.invalid/#/docs?path=%ZZ",
    "https://example.invalid/#%2Fdocs%3Fpath%3D%25ZZ",
    "https://example.invalid/#%2Fdocs%3F%25ZZ%3Dsafe",
    "https://example.invalid/#%2Fdocs%3F%25ZZ",
  ];

  for (const content of malformedContents) {
    assert.throws(
      () => scanTrackedContent({ "fixtures/malformed-route.txt": content }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "malformed URL escape");
        return true;
      },
    );
  }
});

test("does not grant whole-file exemptions to scanner or privacy paths", () => {
  const findings = scanTrackedContent({
    "scripts/public-safety-scan.ts": "ghp_" + "syntheticalphanumerictoken123456",
    "scripts/public-safety-scan.test.ts": "/" + "Users/example/private",
    "docs/privacy.md": "source:" + "internal-fixture",
  });

  assert.deepEqual(findings, [
    { path: "scripts/public-safety-scan.ts", rule: "credential-shape" },
    { path: "scripts/public-safety-scan.test.ts", rule: "local-path" },
    { path: "docs/privacy.md", rule: "internal-source" },
  ]);
});

test("limits the scanner-test allowance to malformed URL occurrences", () => {
  const findings = scanTrackedContent({
    "scripts/public-safety-scan.test.ts":
      "https://example.invalid/docs?path=%ZZ "
      + "https://example.invalid/#%2Fdocs%3Fpath%3D%25ZZ and /"
      + "Users/example/private",
  });

  assert.deepEqual(findings, [
    { path: "scripts/public-safety-scan.test.ts", rule: "local-path" },
  ]);
});

test("reports only the path and rule for synthetic identity shapes", () => {
  const findings = scanTrackedContent({
    "fixtures/email.txt":
      "contact: synthetic.person@" + "example.invalid",
    "fixtures/phone.txt": "contact: +" + "1 555 010 0123",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    ["fixtures/email.txt", "fixtures/phone.txt"],
  );
  assert.ok(findings.every((item) => item.rule === "real-identity"));
  assert.equal(JSON.stringify(findings).includes("synthetic.person"), false);
});

test("detects contextual domestic phones without flagging bare numeric ids", () => {
  const findings = scanTrackedContent({
    "fixtures/mobile.txt": "mobile: " + "199" + "00000000",
    "fixtures/local-phone.txt": "phone: " + "(010) 5555-0123",
    "fixtures/order.txt": "order_id: " + "199" + "00000000",
    "fixtures/counter.txt": "counter=12345678901",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    ["fixtures/local-phone.txt", "fixtures/mobile.txt"],
  );
  assert.ok(findings.every((item) => item.rule === "real-identity"));
});

test("detects distinctive international and contextual common phone forms", () => {
  const findings = scanTrackedContent({
    "fixtures/international.txt":
      "reach the synthetic desk at +" + "1 (415) 555-0123",
    "fixtures/us-hyphen.txt": "phone: " + "415-555-0123",
    "fixtures/us-parenthesized.txt": "tel: " + "(415) 555-0123",
    "fixtures/chinese-mobile.txt": "手机：" + "199" + "00000000",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    [
      "fixtures/chinese-mobile.txt",
      "fixtures/international.txt",
      "fixtures/us-hyphen.txt",
      "fixtures/us-parenthesized.txt",
    ],
  );
  assert.ok(findings.every((item) => item.rule === "real-identity"));
});

test("requires a complete context-label token for ambiguous phone forms", () => {
  const findings = scanTrackedContent({
    "fixtures/microphone.txt": "microphone: " + "199" + "00000000",
    "fixtures/suffix-label.txt": "xphone: " + "(010) 5555-0123",
    "fixtures/cjk-suffix-label.txt": "合成phone: " + "415-555-0123",
    "fixtures/bare-us.txt": "account_id=415-555-0123",
    "fixtures/bare-mobile.txt": "order_id=" + "199" + "00000000",
    "fixtures/embedded-plus.txt": "id+" + "1 (415) 555-0123",
    "fixtures/cjk-embedded-plus.txt": "编号+" + "1 (415) 555-0123",
  });

  assert.deepEqual(findings, []);
});

test("uses Unicode word boundaries around labels and plus candidates", () => {
  const phone = "415-555-0123";
  const plusPhone = "+" + "1 (415) 555-0123";
  const findings = scanTrackedContent({
    "fixtures/latin-label-prefix.txt": `éphone: ${phone}`,
    "fixtures/latin-label-suffix.txt": `phone: ${phone}é`,
    "fixtures/kana-label-prefix.txt": `カphone: ${phone}`,
    "fixtures/kana-label-suffix.txt": `phone: ${phone}カ`,
    "fixtures/hangul-label-prefix.txt": `가phone: ${phone}`,
    "fixtures/hangul-label-suffix.txt": `phone: ${phone}가`,
    "fixtures/astral-label-prefix.txt": `𐐀phone: ${phone}`,
    "fixtures/astral-label-suffix.txt": `phone: ${phone}𐐀`,
    "fixtures/latin-plus-prefix.txt": `é${plusPhone}`,
    "fixtures/latin-plus-suffix.txt": `${plusPhone}é`,
    "fixtures/kana-plus-prefix.txt": `カ${plusPhone}`,
    "fixtures/kana-plus-suffix.txt": `${plusPhone}カ`,
    "fixtures/hangul-plus-prefix.txt": `가${plusPhone}`,
    "fixtures/hangul-plus-suffix.txt": `${plusPhone}가`,
    "fixtures/astral-plus-prefix.txt": `𐐀${plusPhone}`,
    "fixtures/astral-plus-suffix.txt": `${plusPhone}𐐀`,
  });

  assert.deepEqual(findings, []);
});

test("enforces eight to fifteen total digits for plus candidates", () => {
  const findings = scanTrackedContent({
    "fixtures/minimum.txt": "reach +" + "1 555 0123",
    "fixtures/maximum.txt": "reach +" + "123 456 789 012 345",
    "fixtures/too-short.txt": "reach +" + "1 555 012",
    "fixtures/too-long.txt": "reach +" + "123 456 789 012 345 6",
  });

  assert.deepEqual(
    findings.map((item) => item.path).sort(),
    ["fixtures/maximum.txt", "fixtures/minimum.txt"],
  );
  assert.ok(findings.every((item) => item.rule === "real-identity"));
});

test("rejects an escaping symlink without dereferencing its external target", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-symlink-"));
  const repository = join(fixtureRoot, "repository");
  mkdirSync(repository);

  try {
    writeFileSync(
      join(fixtureRoot, "external-target.txt"),
      "ghp_" + "syntheticexternaltarget1234567890",
    );
    symlinkSync("../external-target.txt", join(repository, "tracked-link"));
    runGit(repository, ["init", "-q"]);
    runGit(repository, ["add", "tracked-link"]);

    const result = runSafetyCli(repository);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /tracked-link\tunsafe-symlink/);
    assert.doesNotMatch(result.stderr, /credential-shape/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects absolute and lexically escaping symlink targets", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-link-paths-"));

  try {
    mkdirSync(join(fixtureRoot, "nested"));
    symlinkSync("/etc/passwd", join(fixtureRoot, "absolute-link"));
    symlinkSync("../../outside.txt", join(fixtureRoot, "nested", "escaping-link"));
    symlinkSync("../public-fixture.txt", join(fixtureRoot, "nested", "safe-link"));
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "absolute-link", "nested/escaping-link", "nested/safe-link"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /absolute-link\tunsafe-symlink/);
    assert.match(result.stderr, /nested\/escaping-link\tunsafe-symlink/);
    assert.doesNotMatch(result.stderr, /nested\/safe-link/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("scans tracked symlink text without opening its target", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-link-text-"));

  try {
    symlinkSync("source:" + "internal-fixture", join(fixtureRoot, "public-link"));
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "public-link"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /public-link\tinternal-source/);
    assert.doesNotMatch(result.stderr, /scan failed/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects an unapproved binary instead of silently skipping it", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-binary-"));

  try {
    writeFileSync(
      join(fixtureRoot, "synthetic-binary.bin"),
      Buffer.concat([
        Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 16, 17]),
        Buffer.from("ghp_" + "syntheticbinarytoken1234567890"),
      ]),
    );
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "synthetic-binary.bin"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /synthetic-binary\.bin\tunapproved-binary/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

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

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

test("allows only the two structurally valid release PNG dimensions", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-approved-png-"));
  const publicDir = join(fixtureRoot, "public");
  mkdirSync(publicDir);

  try {
    for (const name of ["evidence-agent-lab-desktop.png", "evidence-agent-lab-mobile.png"]) {
      writeFileSync(
        join(publicDir, name),
        readFileSync(new URL(`../public/${name}`, import.meta.url)),
      );
    }
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "public"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /0 public-safety findings/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects credential-bearing PNG text metadata even with a valid chunk checksum", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-png-metadata-"));
  const publicDir = join(fixtureRoot, "public");
  mkdirSync(publicDir);

  try {
    const original = readFileSync(new URL("../public/evidence-agent-lab-desktop.png", import.meta.url));
    const textChunk = pngChunk(
      "tEXt",
      Buffer.from("Comment\0" + "ghp_" + "syntheticpngtoken123456789012345", "latin1"),
    );
    const withMetadata = Buffer.concat([
      original.subarray(0, original.length - 12),
      textChunk,
      original.subarray(original.length - 12),
    ]);
    writeFileSync(join(publicDir, "evidence-agent-lab-desktop.png"), withMetadata);
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "public/evidence-agent-lab-desktop.png"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /public\/evidence-agent-lab-desktop\.png\tinvalid-binary/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects malformed or dimension-mismatched approved PNGs", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-invalid-png-"));
  const publicDir = join(fixtureRoot, "public");
  mkdirSync(publicDir);

  try {
    writeFileSync(
      join(publicDir, "evidence-agent-lab-desktop.png"),
      readFileSync(new URL("../public/evidence-agent-lab-mobile.png", import.meta.url)),
    );
    writeFileSync(
      join(publicDir, "evidence-agent-lab-mobile.png"),
      Buffer.from("not a complete png\0", "utf8"),
    );
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "public"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /public\/evidence-agent-lab-desktop\.png\tinvalid-binary/);
    assert.match(result.stderr, /public\/evidence-agent-lab-mobile\.png\tinvalid-binary/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("classifies normal Unicode as text and scans it", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-unicode-"));

  try {
    writeFileSync(
      join(fixtureRoot, "unicode.txt"),
      "公开合成文本 source:" + "internal-fixture",
    );
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "unicode.txt"]);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /unicode\.txt\tinternal-source/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("fails closed when a tracked file cannot be read", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-read-error-"));
  const trackedPath = join(fixtureRoot, "missing-after-index.txt");

  try {
    writeFileSync(trackedPath, "synthetic public text");
    runGit(fixtureRoot, ["init", "-q"]);
    runGit(fixtureRoot, ["add", "missing-after-index.txt"]);
    rmSync(trackedPath);

    const result = runSafetyCli(fixtureRoot);

    assert.equal(result.status, 1);
    assert.equal(result.stderr, "public-safety scan failed\n");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
