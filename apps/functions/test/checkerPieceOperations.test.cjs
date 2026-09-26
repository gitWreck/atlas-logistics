"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectAlreadyDeliveredPieceIdentities,
} = require("../src/checker/checkerPieceOperations");

test("accepts requested pieces already delivered by the same checker", () => {
  const packages = [
    {
      packageId: "PIECE-1",
      status: "DELIVERED",
      deliveredByCheckerId: "checker-1",
    },
    {
      packageId: "PIECE-2",
      status: "DELIVERED",
      deliveredByCheckerId: "checker-1",
    },
  ];

  assert.deepEqual(
    collectAlreadyDeliveredPieceIdentities(packages, {
      checkerUid: "checker-1",
      packageIdSet: new Set(["PIECE-1", "PIECE-2"]),
    }),
    ["PIECE-1", "PIECE-2"],
  );
});

test("does not treat another checker's delivery as an idempotent success", () => {
  const packages = [
    {
      packageId: "PIECE-1",
      status: "DELIVERED",
      deliveredByCheckerId: "checker-2",
    },
  ];

  assert.deepEqual(
    collectAlreadyDeliveredPieceIdentities(packages, {
      checkerUid: "checker-1",
      packageIdSet: new Set(["PIECE-1"]),
    }),
    [],
  );
});

test("does not accept a request with any piece still undelivered", () => {
  const packages = [
    {
      packageId: "PIECE-1",
      status: "DELIVERED",
      deliveredByCheckerId: "checker-1",
    },
    { packageId: "PIECE-2", status: "OUT_FOR_DELIVERY" },
  ];

  assert.deepEqual(
    collectAlreadyDeliveredPieceIdentities(packages, {
      checkerUid: "checker-1",
      packageIdSet: new Set(["PIECE-1", "PIECE-2"]),
    }),
    [],
  );
});