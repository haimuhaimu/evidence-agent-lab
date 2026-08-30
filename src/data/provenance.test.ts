import assert from "node:assert/strict";
import test from "node:test";
import { SYNTHETIC_ENTITIES } from "./synthetic-entities";
import { SYNTHETIC_PROVENANCE } from "./provenance";

test("every fixture declares synthetic provenance and a unique id", () => {
  assert.equal(SYNTHETIC_PROVENANCE.kind, "synthetic");
  assert.equal(new Set(SYNTHETIC_ENTITIES.map((item) => item.id)).size, SYNTHETIC_ENTITIES.length);
  assert.ok(SYNTHETIC_ENTITIES.every((item) => item.source === "synthetic"));
});
