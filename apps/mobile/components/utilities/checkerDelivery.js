import {
  loadPackagesToDeliveryManifest,
  reportFailedDelivery,
  returnPackagesToWarehouse,
  updateShipmentStatus,
} from "./FirebaseFunctions";
import { getCurrentLocationSafe, updatedBy } from "./helpers";

export function isAssignedToChecker(shipment, checkerUid) {
  if (!shipment || !checkerUid) return false;
  return String(shipment.assignedCheckerId || "") === String(checkerUid);
}

export function assertAssignedToChecker(shipment, checkerUid) {
  if (!isAssignedToChecker(shipment, checkerUid)) {
    throw new Error(
      "This package is not assigned to you. Ask your warehouse manager to release it first.",
    );
  }
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
  profile,
  remarks = "",
}) {
  const location = await getCurrentLocationSafe();
  const response = await loadPackagesToDeliveryManifest({
    shipmentIds,
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
