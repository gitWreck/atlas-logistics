export const MANIFEST_STATUS = Object.freeze({
  OPEN: "OPEN",
  LOCKED: "LOCKED",
  RECEIVING_IN_PROGRESS: "RECEIVING_IN_PROGRESS",
  RECONCILED: "RECONCILED",
});

export const MANIFEST_STATUS_LABELS = Object.freeze({
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

export function resolveManifestStatus(trip = {}) {
  const explicit = normalizeManifestStatus(trip.manifestStatus);
  if (explicit) return explicit;

  if (trip.reconciledAt) return MANIFEST_STATUS.RECONCILED;
  if (trip.receivingStartedAt) return MANIFEST_STATUS.RECEIVING_IN_PROGRESS;
  if (trip.manifestLocked === true) return MANIFEST_STATUS.LOCKED;
  return MANIFEST_STATUS.OPEN;
}

export function isManifestOpen(trip = {}) {
  return resolveManifestStatus(trip) === MANIFEST_STATUS.OPEN;
}

export function isManifestLocked(trip = {}) {
  return LOCKED_MANIFEST_STATUSES.has(resolveManifestStatus(trip));
}

export function isReceivingInProgress(trip = {}) {
  return (
    resolveManifestStatus(trip) === MANIFEST_STATUS.RECEIVING_IN_PROGRESS
  );
}

export function isHubTransferTrip(trip = {}) {
  return String(trip.tripType || "HUB_TRANSFER").toUpperCase() === "HUB_TRANSFER";
}

export function canStartReceiving(trip = {}) {
  if (!isHubTransferTrip(trip)) return false;
  if (normalizeTripStatus(trip.status) !== "IN_TRANSIT") return false;
  if (trip.receivingStartedAt) return false;

  const manifestStatus = resolveManifestStatus(trip);
  return (
    manifestStatus === MANIFEST_STATUS.LOCKED ||
    (trip.manifestLocked === true && !trip.receivingStartedAt)
  );
}

export function canDispatchTrip(trip = {}) {
  if (!isHubTransferTrip(trip)) return false;
  if (resolveManifestStatus(trip) !== MANIFEST_STATUS.LOCKED) return false;

  const status = normalizeTripStatus(trip.status);
  if (status === "LOADED") return true;

  // Recovery: scanner used to jump to IN_TRANSIT on lock without dispatch metadata.
  if (status === "IN_TRANSIT" && !trip.dispatchedAt) return true;

  return false;
}

export function getDispatchTripBlockReason(trip = {}) {
  if (!isHubTransferTrip(trip)) return null;
  if (canDispatchTrip(trip)) return null;
  if (resolveManifestStatus(trip) !== MANIFEST_STATUS.LOCKED) return null;
  if (trip.dispatchedAt) return "This trip was already dispatched.";

  const status = normalizeTripStatus(trip.status);
  if (status === "IN_TRANSIT") {
    return "Trip is in transit but was not formally dispatched. Refresh the page or redeploy functions if Dispatch Trip is missing.";
  }
  if (status !== "LOADED") {
    return "Set the trip to LOADED first (scanner: Set to LOADED), then use Dispatch Trip.";
  }

  return null;
}

export function canUnloadAtHub(trip = {}) {
  if (!isHubTransferTrip(trip)) return true;
  if (normalizeTripStatus(trip.status) !== "ARRIVED") return false;
  return resolveManifestStatus(trip) === MANIFEST_STATUS.RECEIVING_IN_PROGRESS;
}

export function isManifestReconciled(trip = {}) {
  return resolveManifestStatus(trip) === MANIFEST_STATUS.RECONCILED;
}

/** User-facing reason when hub unload is blocked (scanner + resolve API). */
export function getUnloadBlockReason(trip = {}) {
  if (!isHubTransferTrip(trip)) {
    const tripStatus = normalizeTripStatus(trip.status);
    if (["ARRIVED", "LOADED", "IN_TRANSIT", "COMPLETED"].includes(tripStatus)) {
      return null;
    }
    return `Cannot unload. Trip status is currently ${tripStatus || "UNKNOWN"}.`;
  }

  if (canUnloadAtHub(trip)) return null;

  const tripStatus = normalizeTripStatus(trip.status);
  const manifestStatus = resolveManifestStatus(trip);

  if (manifestStatus === MANIFEST_STATUS.RECONCILED) {
    return "Manifest is reconciled. Open Reconcile & release shipments below to release to delivery operations.";
  }

  if (canStartReceiving(trip)) {
    return "Start receiving on this trip before unloading packages.";
  }

  if (tripStatus === "IN_TRANSIT" && manifestStatus === MANIFEST_STATUS.LOCKED) {
    return "Start receiving on this trip before unloading packages.";
  }

  if (tripStatus !== "ARRIVED") {
    return `Trip must be ARRIVED with receiving in progress before unloading (current: ${tripStatus || "unknown"}).`;
  }

  return "Receiving has not been started on this trip. Click Start Receiving first.";
}

export function getManifestStatusLabel(tripOrStatus) {
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
