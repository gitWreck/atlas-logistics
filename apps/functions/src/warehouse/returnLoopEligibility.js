"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function hasReturnedToWarehouse(shipmentData = {}) {
  return Boolean(
    shipmentData.returnedAt ||
      normalizeStatus(shipmentData.status) === "RETURNED_TO_WAREHOUSE",
  );
}

function isEligibleForReturnReceive(shipmentData = {}) {
  const status = normalizeStatus(shipmentData.status);

  if (shipmentData.returnReceivedAt) {
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

  const status = normalizeStatus(shipmentData.status);
  if (shipmentData.returnReceivedAt) {
    throw new HttpsError(
      "failed-precondition",
      `Shipment ${shipmentId} was already received by warehouse (${shipmentData.returnReceivedBy || "manager"}).`,
    );
  }

  throw new HttpsError(
    "failed-precondition",
    `Shipment ${shipmentId} is not awaiting returned intake (status: ${status}). Checker must return it to Odiongan first.`,
  );
}

module.exports = {
  normalizeStatus,
  hasReturnedToWarehouse,
  isEligibleForReturnReceive,
  assertEligibleForReturnReceive,
};
