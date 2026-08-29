import assert from "node:assert/strict";
import test from "node:test";

import { scanDependencyLicenses } from "./dependency-license-scan.ts";

test("rejects strong-copyleft and unknown production licenses", () => {
  const findings = scanDependencyLicenses({
    packages: {
      "node_modules/example": {
        name: "example",
        version: "1.0.0",
        dev: false,
        license: "AGPL-3.0",
      },
      "node_modules/missing": {
        name: "missing",
        version: "2.0.0",
        dev: false,
      },
    },
  });

  assert.deepEqual(
    findings.map((item) => item.rule).sort(),
    ["denied-license", "missing-license"],
  );
});

test("ignores the root and development dependencies", () => {
  const findings = scanDependencyLicenses({
    packages: {
      "": { name: "root", version: "0.1.0", license: "AGPL-3.0" },
      "node_modules/dev-only": {
        name: "dev-only",
        version: "1.0.0",
        dev: true,
        license: "GPL-3.0-only",
      },
      "node_modules/permitted": {
        name: "permitted",
        version: "1.0.0",
        dev: false,
        license: "MIT",
      },
    },
  });

  assert.deepEqual(findings, []);
});

test("normalizes denied expressions without exposing lockfile metadata", () => {
  const findings = scanDependencyLicenses({
    packages: {
      "node_modules/outer/node_modules/synthetic-denied": {
        version: "3.2.1",
        dev: false,
        license: "  GPL-3.0-only   OR   MIT  ",
        resolved: "https://registry.invalid/synthetic-denied.tgz",
        integrity: "sha512-synthetic-only",
      },
    },
  });

  assert.deepEqual(findings, [
    {
      packageName: "synthetic-denied",
      version: "3.2.1",
      license: "GPL-3.0-only OR MIT",
      rule: "denied-license",
    },
  ]);
  assert.equal(JSON.stringify(findings).includes("registry.invalid"), false);
  assert.equal(JSON.stringify(findings).includes("synthetic-only"), false);
});

test("covers each denied production license family", () => {
  const deniedLicenses = [
    "GPL-3.0-only",
    "AGPL-3.0-or-later",
    "SSPL-1.0",
    "BUSL-1.1",
    "Commons-Clause",
    "PolyForm-Noncommercial-1.0.0",
  ];
  const packages = Object.fromEntries(
    deniedLicenses.map((license, index) => [
      `node_modules/synthetic-denied-${index}`,
      { version: "1.0.0", dev: false, license },
    ]),
  );

  const findings = scanDependencyLicenses({ packages });

  assert.equal(findings.length, deniedLicenses.length);
  assert.ok(findings.every((item) => item.rule === "denied-license"));
});

test("accepts the explicitly permitted license set", () => {
  const permittedLicenses = [
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "0BSD",
    "CC0-1.0",
    "BlueOak-1.0.0",
    "Unlicense",
  ];
  const packages = Object.fromEntries(
    permittedLicenses.map((license, index) => [
      `node_modules/synthetic-permitted-${index}`,
      { version: "1.0.0", dev: false, license },
    ]),
  );

  assert.deepEqual(scanDependencyLicenses({ packages }), []);
});

test("fails closed when package metadata is unavailable", () => {
  assert.throws(
    () => scanDependencyLicenses({}),
    /lockfile packages are required/,
  );
});
