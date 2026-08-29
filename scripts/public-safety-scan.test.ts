import assert from "node:assert/strict";
import test from "node:test";

import { scanTrackedContent } from "./public-safety-scan.ts";

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
