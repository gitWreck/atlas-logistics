"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { isManifestLocked } = require("./manifestStatus");

const TERMINAL_SHIPMENT_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

/** Scanner / approved workflow statuses while manifest is locked. */
const CUSTODY_SCAN_STATUSES = new Set([
  "RECEIVED",
  "RECEIVED_AT_DIVISORIA",
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "PARTIALLY_IN_TRANSIT",
  "ARRIVED",
  "PARTIALLY_ARRIVED",
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_WAREHOUSE",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "AVAILABLE_FOR_DELIVERY",
  "PARTIALLY_AVAILABLE_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
  "RELEASED_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "PARTIALLY_DELIVERED",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
  "FAILED_DELIVERY",
  "MISSING",
  "DAMAGED",
]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function isTerminalShipment(shipment = {}) {
  return TERMINAL_SHIPMENT_STATUSES.has(normalizeStatus(shipment.status));
}

/**
 * Shipment is under manifest custody lock when on a locked trip and not terminal.
 */
function isShipmentCustodyLocked(shipment = {}, trip = null) {
  if (!shipment || isTerminalShipment(shipment)) return false;
  if (!trip) return false;
  return isManifestLocked(trip);
}

function custodyLockMessage() {
  return (
    "Manifest is locked. Shipment details and packages are read-only until delivery is complete. " +
    "Use approved scans (receive, load, unload, deliver, POD) or ask Admin to unlock the manifest for corrections."
  );
}

function assertCustodyStructuralEditAllowed(shipment = {}, trip = null) {
  if (!isShipmentCustodyLocked(shipment, trip)) return;

  throw new HttpsError("failed-precondition", custodyLockMessage(), {
    code: "MANIFEST_CUSTODY_LOCKED",
  });
}

function assertCustodyScanStatusAllowed(shipment = {}, trip = null, newStatus = "") {
  if (!isShipmentCustodyLocked(shipment, trip)) return;

  const normalized = normalizeStatus(newStatus);
  if (!normalized || CUSTODY_SCAN_STATUSES.has(normalized)) return;

  throw new HttpsError(
    "failed-precondition",
    `Status "${normalized}" is not allowed while the manifest is locked. Use the approved scan workflow or unlock the manifest.`,
    { code: "MANIFEST_CUSTODY_LOCKED" },
  );
}

async function loadTripForShipment(tx, db, { shipment = {}, tripId = null } = {}) {
  const resolvedTripId =
    (typeof tripId === "string" && tripId.trim()) ||
    shipment.currentTripId ||
    shipment.currentTruckTripId ||
    null;

  if (!resolvedTripId) return { tripId: null, trip: null };

  const tripRef = db.collection("truck_trips").doc(resolvedTripId);
  const tripSnap = tx ? await tx.get(tripRef) : await tripRef.get();

  return {
    tripId: resolvedTripId,
    trip: tripSnap?.exists ? tripSnap.data() : null,
  };
}

module.exports = {
  TERMINAL_SHIPMENT_STATUSES,
  CUSTODY_SCAN_STATUSES,
  isTerminalShipment,
  isShipmentCustodyLocked,
  custodyLockMessage,
  assertCustodyStructuralEditAllowed,
  assertCustodyScanStatusAllowed,
  loadTripForShipment,
};
