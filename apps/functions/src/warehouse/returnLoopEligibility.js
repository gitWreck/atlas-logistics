"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const {
  countPiecesAwaitingReturnReceive,
  shipmentHasPiecesAwaitingReturnReceive,
} = require("./packageDeliveryOperations");

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getPackages(shipmentData = {}) {
  return Array.isArray(shipmentData.packages) ? shipmentData.packages : [];
}

function hasReturnedToWarehouse(shipmentData = {}) {
  const packages = getPackages(shipmentData);
  if (shipmentHasPiecesAwaitingReturnReceive(packages)) return true;

  return Boolean(
    shipmentData.returnedAt ||
      normalizeStatus(shipmentData.status) === "RETURNED_TO_WAREHOUSE",
  );
}

function isEligibleForReturnReceive(shipmentData = {}) {
  const packages = getPackages(shipmentData);
  const pendingPieces = countPiecesAwaitingReturnReceive(packages);

  if (pendingPieces > 0) {
    return true;
  }

  const status = normalizeStatus(shipmentData.status);

  if (shipmentData.returnReceivedAt && pendingPieces === 0) {
    return false;
  }

  if (status === "RETURNED_TO_WAREHOUSE") {
    return true;
  }

  if (hasReturnedToWarehouse(shipmentData) && status === "RECEIVED") {
    return true;
  }

  return false;
}

function assertEligibleForReturnReceive(shipmentId, shipmentData = {}) {
  if (isEligibleForReturnReceive(shipmentData)) return;

  const packages = getPackages(shipmentData);
  const pendingPieces = countPiecesAwaitingReturnReceive(packages);
  const status = normalizeStatus(shipmentData.status);

  if (shipmentData.returnReceivedAt && pendingPieces === 0) {
    throw new HttpsError(
      "failed-precondition",
      `Shipment ${shipmentId} was already received by warehouse (${shipmentData.returnReceivedBy || "manager"}). Re-release for delivery when ready.`,
    );
  }

  throw new HttpsError(
    "failed-precondition",
    `Shipment ${shipmentId} has no pieces awaiting returned intake (status: ${status}). Checker must scan return to Odiongan first.`,
  );
}

module.exports = {
  normalizeStatus,
  hasReturnedToWarehouse,
  isEligibleForReturnReceive,
  assertEligibleForReturnReceive,
  countPiecesAwaitingReturnReceive,
};
