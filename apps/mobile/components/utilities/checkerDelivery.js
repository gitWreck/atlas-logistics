import {
  loadPackagesToDeliveryManifest,
  reportFailedDelivery,
  returnPackagesToWarehouse,
  updateShipmentStatus,
} from "./FirebaseFunctions";
import { getCurrentLocationSafe, updatedBy } from "./helpers";

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
  return String(value || "").trim().toUpperCase();
}

function countAvailablePieces(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  return packages.filter((pkg) => {
    const status = normalizeStatus(pkg.status);
    return (
      pkg.availableForDelivery === true ||
      status === "AVAILABLE_AT_WAREHOUSE"
    );
  }).length;
}

/** Next action for checker last-mile on the Assigned list / details screen. */
export function getCheckerDeliveryNextAction(shipment) {
  const status = normalizeStatus(shipment?.status);
  const locationState = normalizeStatus(shipment?.currentLocationState);

  if (status === "OUT_FOR_DELIVERY") return "deliver";
  if (status === "FAILED_DELIVERY") return "return";
  if (
    status === "READY_FOR_DELIVERY" ||
    locationState === "DELIVERY_VEHICLE_LOADED"
  ) {
    return "out_for_delivery";
  }

  if (
    shipment?.availableForDelivery === true ||
    status === "AVAILABLE_FOR_DELIVERY" ||
    countAvailablePieces(shipment) > 0
  ) {
    return "load";
  }

  if (["ASSIGNED", "LOADED", "RELEASED", "RECEIVED", "ARRIVED"].includes(status)) {
    return "load";
  }
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
}) {
  const location = await getCurrentLocationSafe();
  const response = await loadPackagesToDeliveryManifest({
    shipmentIds,
    ...(Array.isArray(packageIds) && packageIds.length > 0
      ? { packageIds }
      : {}),
    location: location ? `${location.lat},${location.lng}` : null,
    gpsCoordinates: location,
    remarks: remarks || "Loaded onto delivery vehicle from checker app.",
  });

  return response?.data || {};
}

export async function markShipmentOutForDelivery({
  shipmentId,
  profile,
  tripId = null,
  remarks = "",
}) {
  const location = await getCurrentLocationSafe();

  await updateShipmentStatus({
    shipmentId,
    tripId,
    newStatus: "OUT_FOR_DELIVERY",
    location,
    remarks: remarks || "Checker marked shipment out for delivery.",
    sourceUI: "CHECKER_MOBILE",
    updatedBy: updatedBy(profile),
  });
}

export async function reportCheckerFailedDelivery({
  shipmentIds,
  profile,
  reasonCode = null,
  remarks = "",
}) {
  const location = await getCurrentLocationSafe();
  const response = await reportFailedDelivery({
    shipmentIds,
    reasonCode,
    remarks: remarks || "Failed delivery reported from checker app.",
    location: location ? `${location.lat},${location.lng}` : null,
    gpsCoordinates: location,
  });
  return response?.data || {};
}

export async function returnCheckerShipmentsToWarehouse({
  shipmentIds,
  profile,
  remarks = "",
  warehouseCode = "ODIONGAN_WAREHOUSE",
}) {
  const location = await getCurrentLocationSafe();
  const response = await returnPackagesToWarehouse({
    shipmentIds,
    warehouseCode,
    remarks: remarks || "Returned to Odiongan warehouse.",
    location: location ? `${location.lat},${location.lng}` : null,
    gpsCoordinates: location,
  });
  return response?.data || {};
}

export async function completeCheckerDelivery({
  shipmentId,
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

  await updateShipmentStatus({
    shipmentId,
    tripId,
    newStatus: "DELIVERED",
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
}
