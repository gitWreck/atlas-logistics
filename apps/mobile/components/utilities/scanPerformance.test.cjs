const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createScanGate,
  createSerialTaskQueue,
} = require("./scanPerformance");

test("accepts different QR codes after the 400ms cooldown", () => {
  const gate = createScanGate();

  assert.equal(gate.accept(" package-a ", 1000).accepted, true);
  assert.deepEqual(gate.accept("PACKAGE-B", 1399), {
    accepted: false,
    reason: "cooldown",
    code: "PACKAGE-B",
  });
  assert.equal(gate.accept("PACKAGE-B", 1400).accepted, true);
});

test("blocks the same normalized QR for 2.5 seconds", () => {
  const gate = createScanGate();

  assert.equal(gate.accept("package-a", 1000).accepted, true);
  assert.equal(gate.accept(" PACKAGE-A ", 2499).reason, "duplicate");
  assert.equal(gate.accept("PACKAGE-A", 3499).reason, "duplicate");
  assert.equal(gate.accept("PACKAGE-A", 3500).accepted, true);
});

test("serial task queue preserves order and continues after a failure", async () => {
  const depthChanges = [];
  const events = [];
  const queue = createSerialTaskQueue({
    onDepthChange: (depth) => depthChanges.push(depth),
  });

  const first = queue.enqueue(async () => {
    events.push("first:start");
    await Promise.resolve();
    events.push("first:end");
  });
  const failed = queue.enqueue(async () => {
    events.push("failed:start");
    throw new Error("expected test failure");
  });
  const last = queue.enqueue(async () => {
    events.push("last:start");
  });

  await first;
  await assert.rejects(failed, /expected test failure/);
  await last;

  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "failed:start",
    "last:start",
  ]);
  assert.equal(queue.getDepth(), 0);
  assert.deepEqual(depthChanges, [1, 2, 3, 2, 1, 0]);
});
