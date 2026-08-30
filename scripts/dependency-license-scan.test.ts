import assert from "node:assert/strict";
import test from "node:test";

import { scanDependencyLicenses } from "./dependency-license-scan";

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

test("accepts the repository's base license expression set", () => {
  const acceptedLicenses = [
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
    acceptedLicenses.map((license, index) => [
      `node_modules/synthetic-accepted-${index}`,
      { version: "1.0.0", dev: false, license },
    ]),
  );

  assert.deepEqual(scanDependencyLicenses({ packages }), []);
});

test("accepts only locally verified package version expression tuples", () => {
  const findings = scanDependencyLicenses({
    packages: {
      "node_modules/caniuse-lite": {
        version: "1.0.30001810",
        license: "CC-BY-4.0",
      },
      "node_modules/@img/sharp-libvips-linux-x64": {
        version: "1.3.3",
        optional: true,
        license: "LGPL-3.0-or-later",
      },
      "node_modules/@img/sharp-win32-x64": {
        version: "0.35.4",
        optional: true,
        license: "Apache-2.0 AND LGPL-3.0-or-later",
      },
      "node_modules/@img/sharp-wasm32": {
        version: "0.35.4",
        optional: true,
        license: "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      },
    },
  });

  assert.deepEqual(findings, []);
});

test("denies every non-empty expression outside the exact accepted set", () => {
  const rejectedLicenses = [
    "UNLICENSED",
    "Proprietary",
    "synthetic-free-form",
    "Unknown-SPDX-1.0",
    "MIT OR Apache-2.0",
    "LGPL-3.0-only",
    "LGPL-3.0-or-later",
    "Apache-2.0 AND MIT",
  ];
  const packages = Object.fromEntries(
    rejectedLicenses.map((license, index) => [
      `node_modules/synthetic-unknown-${index}`,
      { version: "1.0.0", dev: false, license },
    ]),
  );

  const findings = scanDependencyLicenses({ packages });

  assert.deepEqual(
    findings.map((item) => item.license),
    rejectedLicenses,
  );
  assert.ok(findings.every((item) => item.rule === "denied-license"));
});

test("denies a verified expression when its package version is not verified", () => {
  const findings = scanDependencyLicenses({
    packages: {
      "node_modules/caniuse-lite": {
        version: "0.0.0-synthetic",
        license: "CC-BY-4.0",
      },
      "node_modules/@img/sharp-libvips-linux-x64": {
        version: "0.0.0-synthetic",
        license: "LGPL-3.0-or-later",
      },
      "node_modules/@img/sharp-win32-x64": {
        version: "0.0.0-synthetic",
        license: "Apache-2.0 AND LGPL-3.0-or-later",
      },
      "node_modules/@img/sharp-wasm32": {
        version: "0.0.0-synthetic",
        license: "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      },
    },
  });

  assert.deepEqual(findings.map((item) => item.rule), [
    "denied-license",
    "denied-license",
    "denied-license",
    "denied-license",
  ]);
});

test("fails closed when package metadata is unavailable", () => {
  assert.throws(
    () => scanDependencyLicenses({}),
    /lockfile packages are required/,
  );
});

test("resolves a workspace link once and preserves nested scoped names", () => {
  const findings = scanDependencyLicenses({
    packages: {
      "": { name: "root", version: "0.1.0", license: "MIT" },
      "packages/synthetic-workspace": {
        name: "@synthetic/workspace",
        version: "1.2.3",
        license: "Synthetic-Workspace-License",
      },
      "node_modules/@synthetic/workspace": {
        resolved: "packages/synthetic-workspace",
        link: true,
      },
      "node_modules/outer/node_modules/@synthetic/blocked": {
        version: "2.0.0",
        license: "Synthetic-Nested-License",
      },
    },
  });

  assert.deepEqual(findings, [
    {
      packageName: "@synthetic/workspace",
      version: "1.2.3",
      license: "Synthetic-Workspace-License",
      rule: "denied-license",
    },
    {
      packageName: "@synthetic/blocked",
      version: "2.0.0",
      license: "Synthetic-Nested-License",
      rule: "denied-license",
    },
  ]);
});

test("fails closed for absent invalid cyclic or escaping workspace links", () => {
  const invalidLockfiles = [
    {
      packages: {
        "node_modules/synthetic": { link: true, resolved: "packages/missing" },
      },
    },
    {
      packages: {
        "node_modules/synthetic": { link: true, resolved: 42 },
      },
    },
    {
      packages: {
        "node_modules/a": { link: true, resolved: "node_modules/b" },
        "node_modules/b": { link: true, resolved: "node_modules/a" },
      },
    },
    {
      packages: {
        "node_modules/synthetic": { link: true, resolved: "../outside" },
        "../outside": { name: "outside", license: "MIT" },
      },
    },
  ];

  for (const lockfile of invalidLockfiles) {
    assert.throws(() => scanDependencyLicenses(lockfile), /lockfile link/);
  }
});
