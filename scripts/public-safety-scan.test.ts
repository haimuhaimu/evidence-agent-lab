import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { scanTrackedContent } from "./public-safety-scan.ts";

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
      "Cookie: session_id=" + "synthetic-cookie-value-123456",
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
    "fixtures/windows-slashes.txt": "C:" + "/Users/example/work/item.txt",
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
    "https://example.invalid/docs#path=%ZZ%2FUsers%2Fexample",
  ];

  for (const content of malformedContents) {
    assert.throws(
      () => scanTrackedContent({ "fixtures/malformed-url.txt": content }),
      /malformed URL escape/,
    );
  }
});

test("does not scan the documented deny-rule files", () => {
  const findings = scanTrackedContent({
    "scripts/public-safety-scan.ts": "ghp_" + "synthetic_example_token_123456",
    "scripts/public-safety-scan.test.ts": "/" + "Users/example/private",
    "docs/privacy.md": "source:" + "internal-fixture",
  });

  assert.deepEqual(findings, []);
});

test("reports only the path and rule for synthetic identity shapes", () => {
  const findings = scanTrackedContent({
    "fixtures/email.txt":
      "contact: synthetic.person@" + "example.invalid",
    "fixtures/phone.txt": "contact: +1 555 010 0123",
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

test("never dereferences a tracked symlink outside the repository", () => {
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

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /0 public-safety findings/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("scans tracked symlink text without opening its target", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "safety-link-text-"));

  try {
    symlinkSync("source:internal-fixture", join(fixtureRoot, "public-link"));
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

test("skips NUL-free binary content before scanning text shapes", () => {
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

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /0 public-safety findings/);
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
