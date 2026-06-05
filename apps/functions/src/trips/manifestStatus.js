"use strict";

const MANIFEST_STATUS = Object.freeze({
  OPEN: "OPEN",
  LOCKED: "LOCKED",
  RECEIVING_IN_PROGRESS: "RECEIVING_IN_PROGRESS",
  RECONCILED: "RECONCILED",
});

const MANIFEST_STATUS_LABELS = Object.freeze({
  [MANIFEST_STATUS.OPEN]: "Open",
  [MANIFEST_STATUS.LOCKED]: "Locked",
  [MANIFEST_STATUS.RECEIVING_IN_PROGRESS]: "Receiving in progress",
  [MANIFEST_STATUS.RECONCILED]: "Reconciled",
});

const LOCKED_MANIFEST_STATUSES = new Set([
  MANIFEST_STATUS.LOCKED,
  MANIFEST_STATUS.RECEIVING_IN_PROGRESS,
  MANIFEST_STATUS.RECONCILED,
]);

function normalizeTripStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase();
}

function normalizeManifestStatus(status) {
  const raw = String(status || "")
    .trim()
    .toUpperCase();
  if (raw === "OPEN_FOR_EDIT") return MANIFEST_STATUS.OPEN;
  if (Object.values(MANIFEST_STATUS).includes(raw)) return raw;
  return "";
}

/**
 * Resolve manifest status from explicit field or legacy trip flags.
 */
function resolveManifestStatus(trip = {}) {
  const explicit = normalizeManifestStatus(trip.manifestStatus);
  if (explicit) return explicit;

  if (trip.reconciledAt) return MANIFEST_STATUS.RECONCILED;
  if (trip.receivingStartedAt) return MANIFEST_STATUS.RECEIVING_IN_PROGRESS;
  if (trip.manifestLocked === true) return MANIFEST_STATUS.LOCKED;
  return MANIFEST_STATUS.OPEN;
}

function isManifestOpen(trip = {}) {
  return resolveManifestStatus(trip) === MANIFEST_STATUS.OPEN;
}

function isManifestLocked(trip = {}) {
  return LOCKED_MANIFEST_STATUSES.has(resolveManifestStatus(trip));
}

function isReceivingInProgress(trip = {}) {
  return (
    resolveManifestStatus(trip) === MANIFEST_STATUS.RECEIVING_IN_PROGRESS
  );
}

function isHubTransferTrip(trip = {}) {
  return String(trip.tripType || "HUB_TRANSFER").toUpperCase() === "HUB_TRANSFER";
}

function canStartReceiving(trip = {}) {
  if (!isHubTransferTrip(trip)) return false;
  if (normalizeTripStatus(trip.status) !== "IN_TRANSIT") return false;
  if (trip.receivingStartedAt) return false;

  const manifestStatus = resolveManifestStatus(trip);
  return (
    manifestStatus === MANIFEST_STATUS.LOCKED ||
    (trip.manifestLocked === true && !trip.receivingStartedAt)
  );
}

function canDispatchTrip(trip = {}) {
  if (!isHubTransferTrip(trip)) return false;
  if (resolveManifestStatus(trip) !== MANIFEST_STATUS.LOCKED) return false;

  const status = normalizeTripStatus(trip.status);
  if (status === "LOADED") return true;

  if (status === "IN_TRANSIT" && !trip.dispatchedAt) return true;

  return false;
}

function canUnloadAtHub(trip = {}) {
  if (!isHubTransferTrip(trip)) return true;
  if (normalizeTripStatus(trip.status) !== "ARRIVED") return false;
  return resolveManifestStatus(trip) === MANIFEST_STATUS.RECEIVING_IN_PROGRESS;
}

function canUnlockManifest(trip = {}) {
  const manifestStatus = resolveManifestStatus(trip);
  return (
    manifestStatus === MANIFEST_STATUS.LOCKED ||
    manifestStatus === MANIFEST_STATUS.OPEN
  );
}

function getManifestStatusLabel(tripOrStatus) {
  const status =
    tripOrStatus && typeof tripOrStatus === "object"
      ? resolveManifestStatus(tripOrStatus)
      : normalizeManifestStatus(tripOrStatus);

  if (MANIFEST_STATUS_LABELS[status]) return MANIFEST_STATUS_LABELS[status];

  return String(status || "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function assertCanUnloadAtHub(trip = {}, tripId = "") {
  if (!isHubTransferTrip(trip) || canUnloadAtHub(trip)) return;

  const manifestStatus = resolveManifestStatus(trip);
  const tripStatus = normalizeTripStatus(trip.status);

  const { HttpsError } = require("firebase-functions/v2/https");

  if (tripStatus === "IN_TRANSIT" && manifestStatus === MANIFEST_STATUS.LOCKED) {
    throw new HttpsError(
      "failed-precondition",
      "Start receiving on this trip before unloading packages.",
    );
  }

  if (tripStatus !== "ARRIVED") {
    throw new HttpsError(
      "failed-precondition",
      `Trip must be ARRIVED with receiving in progress before unloading (current: ${tripStatus || "unknown"}).`,
    );
  }

  throw new HttpsError(
    "failed-precondition",
    "Receiving has not been started on this trip. Click Start Receiving first.",
  );
}

module.exports = {
  MANIFEST_STATUS,
  MANIFEST_STATUS_LABELS,
  LOCKED_MANIFEST_STATUSES,
  normalizeManifestStatus,
  resolveManifestStatus,
  isManifestOpen,
  isManifestLocked,
  isReceivingInProgress,
  isHubTransferTrip,
  canStartReceiving,
  canDispatchTrip,
  canUnloadAtHub,
  canUnlockManifest,
  getManifestStatusLabel,
  assertCanUnloadAtHub,
};
