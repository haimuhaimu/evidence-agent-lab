import assert from "node:assert/strict";
import test from "node:test";
import { buildEscalationPacket } from "./build-escalation-packet";

test("never creates a production delivery claim", () => {
  const packet = buildEscalationPacket("content_feed_drop", ["feed-share-drop"]);

  assert.equal(packet.delivery, "not_sent");
  assert.match(packet.note, /demo/i);
  assert.equal(packet.call.status, "completed");
  assert.deepEqual(packet.call.evidence.map((item) => item.id), ["escalation-packet"]);
  assert.equal(packet.call.evidence[0].value, "not_sent");
});

test("builds a local structured packet without sharing caller-owned evidence", () => {
  const evidenceIds = ["primary-signal", "feed-share-vs-history"];
  const packet = buildEscalationPacket("content_feed_drop", evidenceIds);

  assert.equal(packet.entityId, "content_feed_drop");
  assert.deepEqual(packet.evidenceIds, evidenceIds);
  assert.notEqual(packet.evidenceIds, evidenceIds);

  packet.evidenceIds.push("local-change");
  assert.deepEqual(evidenceIds, ["primary-signal", "feed-share-vs-history"]);
});
