import { getFunctions, httpsCallable } from "firebase/functions";
import { app as mainApp, auth } from "@/lib/firebase";

// ⚠️ Make sure this matches your deployed region!
const functions = getFunctions(mainApp, "asia-southeast1");

// PACKAGES
// export const createPackage = httpsCallable(functions, "createPackage");
export const createShipment = httpsCallable(functions, "createShipment");
export const createShipmentBundle = httpsCallable(
  functions,
  "createShipmentBundle",
);
export const createShipmentWithPackages = httpsCallable(
  functions,
  "createShipmentWithPackages",
);
export async function updateShipmentStatus({
  shipmentId,
  newStatus,
  notify = false,
  remarks = null,
  tripId = null,
  sourceUI = "SHIPMENT_DRAWER",
  notifySms,
  notifyEmail,
  notifyPush,
  location = null,
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("You must be signed in to update shipment status.");
  }

  const res = await fetch(
    `/api/shipments/${encodeURIComponent(shipmentId)}/update-status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        newStatus,
        notify,
        remarks,
        tripId,
        sourceUI,
        notifySms,
        notifyEmail,
        notifyPush,
        location,
      }),
    },
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Failed to update shipment status.");
  }

  return payload;
}

export async function overrideShipmentPieceStatus({
  shipmentId,
  packageId,
  newStatus,
  remarks = null,
  sourceUI = "SHIPMENT_DRAWER",
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("You must be signed in to update piece status.");
  }

  const res = await fetch(
    `/api/shipments/${encodeURIComponent(shipmentId)}/override-piece-status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        packageId,
        newStatus,
        remarks,
        sourceUI,
      }),
    },
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Failed to update piece status.");
  }

  return payload;
}

export async function recoverFoundPackage({
  tripId,
  packageLabel,
  remarks = null,
  sourceUI = "TRIP_DRAWER",
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("You must be signed in to recover found packages.");
  }

  const res = await fetch(
    `/api/trips/${encodeURIComponent(tripId)}/recover-found-package`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        packageLabel,
        remarks,
        sourceUI,
      }),
    },
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Failed to recover found package.");
  }

  return payload;
}

export const updateShipmentPackageStatus = httpsCallable(
  functions,
  "updateShipmentPackageStatus",
);
export const updateShipmentPackages = httpsCallable(
  functions,
  "updateShipmentPackages",
);
export const reconcileShipmentAtHub = httpsCallable(
  functions,
  "reconcileShipmentAtHub",
);
export const receiveReturnedShipmentAtHub = httpsCallable(
  functions,
  "receiveReturnedShipmentAtHub",
);
/** @deprecated Use releaseForDeliveryOperations (pool model; custody stays at warehouse). */
export const releasePackagesToChecker = httpsCallable(
  functions,
  "releasePackagesToChecker",
);
export const releaseForDeliveryOperations = httpsCallable(
  functions,
  "releaseForDeliveryOperations",
);
export const assignRoute = httpsCallable(functions, "assignRoute");
export const listDeliveryRoutes = httpsCallable(functions, "listDeliveryRoutes");
export const getShipmentCustodyTimeline = httpsCallable(
  functions,
  "getShipmentCustodyTimeline",
);

// TRIPS
export const createTruckTrip = httpsCallable(functions, "createTruckTrip");
export const assignShipmentToTrip = httpsCallable(
  functions,
  "assignShipmentToTrip",
);
export const manualAssignShipmentToTrip = httpsCallable(
  functions,
  "manualAssignShipmentToTrip",
);
export const unassignShipmentFromTrip = httpsCallable(
  functions,
  "unassignShipmentFromTrip",
);

export const updateTripSchedule = httpsCallable(
  functions,
  "updateTripSchedule",
);
export const updateTripDetails = httpsCallable(functions, "updateTripDetails");

export const disableTruckTrip = httpsCallable(functions, "disableTruckTrip");
/** @deprecated Hard delete disabled — use cancelTruckTrip or archiveTruckTrip */
export const deleteTruckTrip = httpsCallable(functions, "deleteTruckTrip");
export const cancelTruckTrip = httpsCallable(functions, "cancelTruckTrip");
export const archiveTruckTrip = httpsCallable(functions, "archiveTruckTrip");
export const getTripAuditLog = httpsCallable(functions, "getTripAuditLog");
export const setTruckDelay = httpsCallable(functions, "setTruckDelay");
export const clearTruckDelay = httpsCallable(functions, "clearTruckDelay");
export const updateTripStatus = httpsCallable(functions, "updateTripStatus");
export const startReceiving = httpsCallable(functions, "startReceiving");
export const dispatchTrip = httpsCallable(functions, "dispatchTrip");
/** @deprecated Use releaseForDeliveryOperations after trip ARRIVED (pool model). */
export const finalizeTripUnloadHandoff = httpsCallable(
  functions,
  "finalizeTripUnloadHandoff",
);
/** @deprecated Use releaseForDeliveryOperations after trip ARRIVED (pool model). */
export const finalizeTripUnloadReadyForDelivery = httpsCallable(
  functions,
  "finalizeTripUnloadReadyForDelivery",
);
export const resolveDelayReport = httpsCallable(
  functions,
  "resolveDelayReport",
);

// DRIVERS
export const assignDriverToTrip = httpsCallable(
  functions,
  "assignDriverToTrip",
);
export const unassignDriverFromTrip = httpsCallable(
  functions,
  "unassignDriverFromTrip",
);
export const removeAssignmentFromTrip = httpsCallable(
  functions,
  "removeAssignmentFromTrip",
);
export const assignmentToTrip = httpsCallable(functions, "assignmentToTrip");

// SHIPMENTS
export const generateTripManifest = httpsCallable(
  functions,
  "generateTripManifest",
);
export const verifyTripManifest = httpsCallable(
  functions,
  "verifyTripManifest",
);
export const reopenTrip = httpsCallable(functions, "reopentrip");
export const unlockTripManifest = httpsCallable(
  functions,
  "unlockTripManifest",
);
export const bulkAssignShipments = httpsCallable(
  functions,
  "bulkAssignShipments",
);
export const splitShipments = httpsCallable(functions, "splitShipments");
export const bulkShipmentAction = httpsCallable(
  functions,
  "bulkShipmentAction",
);
export const updateShipmentImages = httpsCallable(
  functions,
  "updateShipmentImages",
);
export const updateShipmentDetails = httpsCallable(
  functions,
  "updateShipmentDetails",
);
export const deleteShipment = httpsCallable(functions, "deleteShipment");

// SMS & COMMUNICATION
export const sendManualSms = httpsCallable(functions, "sendManualSms");
export const broadcastTripMessage = httpsCallable(
  functions,
  "broadcastTripMessage",
);
export const retryCustomerNotification = httpsCallable(
  functions,
  "retryCustomerNotification",
);
export const createConversation = httpsCallable(
  functions,
  "createConversation",
);
export const sendChatMessage = httpsCallable(functions, "sendChatMessage");
export const markConversationRead = httpsCallable(
  functions,
  "markConversationRead",
);
export const updateConversationStatus = httpsCallable(
  functions,
  "updateConversationStatus",
);
export const assignConversation = httpsCallable(
  functions,
  "assignConversation",
);

// INVOICES
export const createInvoice = httpsCallable(functions, "createInvoice");
export const editInvoice = httpsCallable(functions, "editInvoice");
export const updateInvoiceStatus = httpsCallable(
  functions,
  "updateInvoiceStatus",
);

// ADMIN
export const createUserProfile = httpsCallable(functions, "createUserProfile");
export const ensureUserPublicId = httpsCallable(
  functions,
  "ensureUserPublicId",
);
export const toggleUserStatus = httpsCallable(functions, "toggleUserStatus");
export const updateUserProfile = httpsCallable(functions, "updateUserProfile");

// TRUCKS
export const upsertTruck = httpsCallable(functions, "upsertTruck");
export const updateTruckStatus = httpsCallable(functions, "updateTruckStatus");

// ----------------------------

export const sendBulkSMSCallable = httpsCallable(functions, "sendBulkSMS");
export const setTruckAutoSmsSettingsCallable = httpsCallable(
  functions,
  "setTruckAutoSmsSettings",
);
export const transitionPackageStatusCallable = httpsCallable(
  functions,
  "transitionPackageStatus",
);
export const loadItemsToTripCallable = httpsCallable(
  functions,
  "loadItemsToTrip",
);
export const unloadItemsFromTripCallable = httpsCallable(
  functions,
  "unloadItemsFromTrip",
);
export const recordPartialCallable = httpsCallable(functions, "recordPartial");
export const completeTripCallable = httpsCallable(functions, "completeTrip");
