const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  compactOfflineOperation,
  getPendingQueueOperations,
  prepareQueueSnapshot,
} = require("./offlineQueuePerformance");

test("startup automatically selects new work without retrying every failed item", () => {
  const queue = [
    { id: "pending", status: "pending" },
    { id: "failed", status: "failed" },
    { id: "synced", status: "synced" },
  ];

  assert.deepEqual(
    getPendingQueueOperations(queue, { includeFailed: false }).map(
      (operation) => operation.id,
    ),
    ["pending"],
  );
  assert.deepEqual(
    getPendingQueueOperations(queue).map((operation) => operation.id),
    ["pending", "failed"],
  );
});

test("queue preparation recovers interrupted work and prunes completed entries once", () => {
  const result = prepareQueueSnapshot(
    [
      {
        id: "stuck",
        status: "syncing",
        syncingStartedAt: 1_000,
      },
      { id: "recent", status: "syncing", syncingStartedAt: 99_500 },
      { id: "done", status: "synced" },
    ],
    { now: 100_000, maxSyncingAgeMs: 10_000, pruneSynced: true },
  );

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.queue.map(({ id, status }) => ({ id, status })),
    [
      { id: "stuck", status: "failed" },
      { id: "recent", status: "syncing" },
    ],
  );
});

test("queue preparation migrates oversized legacy shipment snapshots", () => {
  const result = prepareQueueSnapshot([
    {
      id: "legacy",
      status: "failed",
      shipmentSnapshot: {
        id: "shipment-1",
        isCOD: false,
        packages: [{ packageId: "piece-1" }],
        statusHistory: Array.from({ length: 100 }, (_, index) => ({ index })),
      },
    },
  ]);

  assert.equal(result.changed, true);
  assert.equal(result.queue[0].shipmentSnapshot.id, "shipment-1");
  assert.equal("statusHistory" in result.queue[0].shipmentSnapshot, false);
});

test("offline queue stores a compact shipment snapshot without losing scan state", () => {
  const operation = compactOfflineOperation({
    type: "DELIVERED",
    shipmentSnapshot: {
      id: "shipment-1",
      isCOD: true,
      status: "OUT_FOR_DELIVERY",
      packages: [{ packageId: "piece-1", status: "OUT_FOR_DELIVERY" }],
      statusHistory: Array.from({ length: 500 }, (_, index) => ({ index })),
      largeUnneededField: "x".repeat(10_000),
    },
  });

  assert.equal(operation.shipmentSnapshot.id, "shipment-1");
  assert.equal(operation.shipmentSnapshot.isCOD, true);
  assert.equal(operation.shipmentSnapshot.packages.length, 1);
  assert.equal("statusHistory" in operation.shipmentSnapshot, false);
  assert.equal("largeUnneededField" in operation.shipmentSnapshot, false);
});

test("checker startup defers queue hydration and observes only current manifests", () => {
  const mobileRoot = path.join(__dirname, "..", "..");
  const offlineContext = readFileSync(
    path.join(mobileRoot, "contexts", "OfflineSyncContext.js"),
    "utf8",
  );
  const lastMile = readFileSync(
    path.join(mobileRoot, "hooks", "useCheckerLastMileSync.js"),
    "utf8",
  );

  assert.match(offlineContext, /InteractionManager\.runAfterInteractions/);
  assert.match(offlineContext, /syncNow\(\{ retryFailed: false \}\)/);
  assert.doesNotMatch(offlineContext, /getPendingCount/);
  assert.match(lastMile, /collectCurrentManifestIds\(/);
  assert.match(
    lastMile,
    /mergeShipmentMaps\(cachedShipmentsById, queryShipments\)/,
  );
  assert.match(
    lastMile,
    /doc\(db, "delivery_manifests", manifestId\)/,
  );
  assert.doesNotMatch(
    lastMile,
    /collection\(db, "delivery_manifests"\)[\s\S]{0,160}where\("checkerId"/,
  );
});
