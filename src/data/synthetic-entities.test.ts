import assert from "node:assert/strict";
import test from "node:test";
import { SYNTHETIC_ENTITIES, getSyntheticEntity } from "./synthetic-entities";

test("returns no object for an unknown id", () => {
  assert.equal(getSyntheticEntity("missing"), undefined);
});

test("locks the exact six-fixture public contract and four declared windows", () => {
  assert.deepEqual(SYNTHETIC_ENTITIES.map((entity) => entity.id), [
    "content_steady",
    "content_scale",
    "content_click_drop",
    "content_retention_drop",
    "content_feed_drop",
    "content_incomplete",
  ]);

  for (const entity of SYNTHETIC_ENTITIES) {
    assert.deepEqual(Object.keys(entity).sort(), [
      "id",
      "policyFlag",
      "publishedHours",
      "source",
      "windows",
    ]);
    assert.equal(entity.source, "synthetic");
    assert.equal(entity.policyFlag, false);
    assert.ok(Number.isFinite(entity.publishedHours));
    assert.ok(entity.publishedHours >= 90 * 24);
    assert.deepEqual(entity.windows.map((window) => window.days), [7, 15, 30, 90]);

    for (const window of entity.windows) {
      assert.deepEqual(Object.keys(window).sort(), [
        "clickRate",
        "completionRate",
        "dataCompleteness",
        "days",
        "exposure",
        "feedShare",
        "historicalExposureMedian",
        "historicalFeedShare",
        "peerClickRate",
        "peerCompletionRate",
        "peerExposureMedian",
      ]);
      assert.ok(Object.values(window).every(Number.isFinite));
      assert.ok(window.exposure >= 0);
      assert.ok(window.historicalExposureMedian > 0);
      assert.ok(window.peerExposureMedian > 0);
      assert.ok(window.dataCompleteness >= 0 && window.dataCompleteness <= 1);
      assert.ok(window.clickRate >= 0 && window.clickRate <= 1);
      assert.ok(window.peerClickRate > 0 && window.peerClickRate <= 1);
      assert.ok(window.completionRate >= 0 && window.completionRate <= 1);
      assert.ok(window.peerCompletionRate > 0 && window.peerCompletionRate <= 1);
      assert.ok(window.feedShare >= 0 && window.feedShare <= 1);
      assert.ok(window.historicalFeedShare > 0 && window.historicalFeedShare <= 1);
    }
  }
});

test("deep-freezes declared fixtures and returns independent deep-frozen copies", () => {
  const declared = SYNTHETIC_ENTITIES[0];
  const first = getSyntheticEntity(declared.id)!;
  const second = getSyntheticEntity(declared.id)!;

  assert.equal(Object.isFrozen(SYNTHETIC_ENTITIES), true);
  assert.equal(Object.isFrozen(declared), true);
  assert.equal(Object.isFrozen(declared.windows), true);
  assert.equal(Object.isFrozen(declared.windows[0]), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.windows), true);
  assert.equal(Object.isFrozen(first.windows[0]), true);
  assert.notStrictEqual(first, declared);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.windows, second.windows);
  assert.throws(() => {
    (first.windows[0] as { exposure: number }).exposure = -1;
  });
  assert.ok(second.windows[0].exposure >= 0);
});
