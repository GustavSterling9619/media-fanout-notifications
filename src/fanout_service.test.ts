import assert from "node:assert/strict";
import {MediaEvent, drain} from "./fanout_service.js";
import {infrai} from "./infrai_client.js";

const valid = {assetId: "asset-1", creatorId: "creator-1", subscribers: ["https://subscriber.test/hook"], status: "processed"};
assert.equal(MediaEvent.parse(valid).subscribers.length, 1);
assert.throws(() => MediaEvent.parse({...valid, subscribers: []}));
console.log("media event boundary: accepted processed asset, rejected empty fanout");

const originalConsume = infrai.queue.consume;
const originalAck = infrai.queue.ack;
try {
  const calls: string[] = [];
  infrai.queue.consume = async () => ({messages: [{message_id: "message-1", payload: valid}]});
  infrai.queue.ack = async (_queue, id) => { calls.push(`ack:${id}`); };
  await drain(async payload => {
    assert.deepEqual(payload, valid);
    await Promise.resolve();
    assert.equal(calls.length, 0);
    calls.push("accepted");
  });
  assert.deepEqual(calls, ["accepted", "ack:message-1"]);
  calls.length = 0;
  await assert.rejects(drain(async () => { throw new Error("delivery failed"); }), /delivery failed/);
  assert.deepEqual(calls, []);
  console.log("drain: acknowledges after acceptance, leaves failed delivery unacknowledged");
} finally {
  infrai.queue.consume = originalConsume;
  infrai.queue.ack = originalAck;
}
