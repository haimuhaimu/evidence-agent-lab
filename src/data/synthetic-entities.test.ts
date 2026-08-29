import assert from "node:assert/strict";
import test from "node:test";
import { getSyntheticEntity } from "./synthetic-entities";

test("returns no object for an unknown id", () => {
  assert.equal(getSyntheticEntity("missing"), undefined);
});
