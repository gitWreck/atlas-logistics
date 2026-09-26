import {
  loadPackagesToDeliveryManifest,
  reportFailedDelivery,
  returnPackagesToWarehouse,
  updateShipmentStatus,
} from "./FirebaseFunctions";
import { getCurrentLocationSafe, updatedBy } from "./helpers";
import {
  countDeliveryPoolPieces,
  countCheckerOutForDeliveryPieces,
  getCheckerPieceActionPhase,
} from "./checkerDeliveryPool";

/** Shipment statuses that permanently end customer communication (spec 12). */
const COMMS_TERMINAL_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
]);

/**
 * Whether the logged-in checker may communicate with the customer for this
 * shipment. Mirrors the backend rule in
 * apps/functions/src/chat/customerCommsAuth.js: the shipment must be active
 * (not delivered/returned/cancelled), assigned to the checker, and have at
 * least one of the checker's pieces still OUT_FOR_DELIVERY or FAILED_DELIVERY
 * (spec 7, 8, 11, 12, 14).
 */
export function canCheckerContactCustomer(shipment, checkerUid) {
  if (!shipment || !checkerUid) return false;
  if (COMMS_TERMINAL_STATUSES.has(String(shipment.status || "").trim().toUpperCase())) {
    return false;
  }
  if (!canCheckerAccessShipment(shipment, checkerUid)) return false;
  return countCheckerOutForDeliveryPieces(shipment, checkerUid) > 0;
}

export function canCheckerAccessShipment(shipment, checkerUid) {
  if (!shipment || !checkerUid) return false;

  if (String(shipment.assignedCheckerId || "") === String(checkerUid)) {
    return true;
  }

  if (shipment.availableForDelivery === true) {
    return true;
  }

  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  return packages.some(
    (pkg) => String(pkg.loadedByCheckerId || "") === String(checkerUid),
  );
}

/** @deprecated Use canCheckerAccessShipment */
export function isAssignedToChecker(shipment, checkerUid) {
  return canCheckerAccessShipment(shipment, checkerUid);
}

export function assertCheckerCanAccessShipment(shipment, checkerUid) {
  if (canCheckerAccessShipment(shipment, checkerUid)) return;
  throw new Error(
    "This shipment is not available for you to load or deliver. Ask warehouse to release it for delivery operations first.",
  );
}

/** @deprecated Use assertCheckerCanAccessShipment */
export function assertAssignedToChecker(shipment, checkerUid) {
  assertCheckerCanAccessShipment(shipment, checkerUid);
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * Next action for checker last-mile (My Deliveries / shipment details).
 * @param {object} shipment
 * @param {string} [checkerUid] — required for pool model (2.7); uses piece counts
 */
export function getCheckerDeliveryNextAction(shipment, checkerUid = null) {
  if (checkerUid) {
    const piecePhase = getCheckerPieceActionPhase(shipment, checkerUid);
    if (piecePhase) return piecePhase;

    const pool = countDeliveryPoolPieces(shipment, checkerUid);
    if (pool.mine === 0) return null;
  }

  const status = normalizeStatus(shipment?.status);

  if (status === "OUT_FOR_DELIVERY") return "deliver";
  if (status === "FAILED_DELIVERY") return "return";

  return null;
}

export function getCheckerDeliveryActionLabel(action) {
  if (action === "out_for_delivery") return "Mark out for delivery";
  if (action === "deliver") return "Complete delivery";
  if (action === "return") return "Return to warehouse";
  return null;
}

export function getCallableErrorMessage(error, fallback) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").trim();

  if (code.includes("permission-denied")) {
    return message || "You are not allowed to perform this action.";
  }
  if (code.includes("failed-precondition")) {
    return message || fallback;
  }
  return message || fallback;
}

export async function loadAssignedShipmentsToVehicle({
  shipmentIds,
  packageIds = null,
  profile,
  remarks = "",
  location = null,
  notificationChannels = null,
}) {
  const resolvedLocation = location || (await getCurrentLocationSafe());
  const response = await loadPackagesToDeliveryManifest({
    shipmentIds,
    ...(Array.isArray(packageIds) && packageIds.length > 0
      ? { packageIds }
      : {}),
    location: resolvedLocation
      ? `${resolvedLocation.lat},${resolvedLocation.lng}`
      : null,
    gpsCoordinates: resolvedLocation,
    notificationChannels,
    remarks: remarks || "Loaded out for delivery from checker app.",
  });

  return response?.data || {};
}

export async function markShipmentOutForDelivery({
  shipmentId,
  profile,
  tripId = null,
  remarks = "",
  location = null,
  notificationChannels = null,
}) {
  const resolvedLocation = location || (await getCurrentLocationSafe());
  const notify = notificationChannels
    ? Object.values(notificationChannels).some(Boolean)
    : false;

  await updateShipmentStatus({
    shipmentId,
    tripId,
    newStatus: "OUT_FOR_DELIVERY",
    location: resolvedLocation,
    remarks: remarks || "Checker marked shipment out for delivery.",
    sourceUI: "CHECKER_MOBILE",
    notify,
    notificationChannels,
    notifySms: notificationChannels?.sms,
    notifyEmail: notificationChannels?.email,
    notifyPush: notificationChannels?.push,
    updatedBy: updatedBy(profile),
  });
}

export async function reportCheckerFailedDelivery({
  shipmentIds,
  packageIds = null,
  profile,
  reasonCode = null,
  remarks = "",
  failurePhotoUrls = null,
  location = null,
  notificationChannels = null,
}) {
  const resolvedLocation = location || (await getCurrentLocationSafe());
  const response = await reportFailedDelivery({
    shipmentIds,
    ...(Array.isArray(packageIds) && packageIds.length > 0
      ? { packageIds }
      : {}),
    reasonCode,
    remarks: remarks || "Failed delivery reported from checker app.",
    location: resolvedLocation
      ? `${resolvedLocation.lat},${resolvedLocation.lng}`
      : null,
    gpsCoordinates: resolvedLocation,
    notificationChannels,
    ...(Array.isArray(failurePhotoUrls) && failurePhotoUrls.length > 0
      ? { failurePhotoUrls }
      : {}),
  });
  return response?.data || {};
}

export async function returnCheckerShipmentsToWarehouse({
  shipmentIds,
  packageIds = null,
  profile,
  remarks = "",
  warehouseCode = "ODIONGAN_WAREHOUSE",
  location = null,
  notificationChannels = null,
}) {
  const resolvedLocation = location || (await getCurrentLocationSafe());
  const response = await returnPackagesToWarehouse({
    shipmentIds,
    ...(Array.isArray(packageIds) && packageIds.length > 0
      ? { packageIds }
      : {}),
    warehouseCode,
    remarks: remarks || "Returned to Odiongan warehouse.",
    location: resolvedLocation
      ? `${resolvedLocation.lat},${resolvedLocation.lng}`
      : null,
    gpsCoordinates: resolvedLocation,
    notificationChannels,
  });
  return response?.data || {};
}

export async function completeCheckerDelivery({
  shipmentId,
  packageIds = null,
  profile,
  tripId = null,
  location,
  photoUrls = [],
  shipment,
  notificationChannels,
}) {
  const notify = notificationChannels
    ? Object.values(notificationChannels).some(Boolean)
    : false;

  const response = await updateShipmentStatus({
    shipmentId,
    tripId,
    newStatus: "DELIVERED",
    ...(Array.isArray(packageIds) && packageIds.length > 0
      ? { packageIds }
      : {}),
    location,
    remarks: `Proof of Delivery: ${photoUrls.length} images uploaded.`,
    proofOfDelivery: photoUrls,
    paymentStatus: shipment?.isCOD ? "COLLECTED_BY_CHECKER" : "PAID",
    sourceUI: "CHECKER_MOBILE",
    notify,
    notificationChannels,
    notifySms: notificationChannels?.sms,
    notifyEmail: notificationChannels?.email,
    notifyPush: notificationChannels?.push,
    updatedBy: updatedBy(profile),
  });

  return response?.data || {};
}
