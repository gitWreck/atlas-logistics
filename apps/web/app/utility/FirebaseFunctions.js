import { getFunctions, httpsCallable } from "firebase/functions";
import { app as mainApp } from "@/lib/firebase";

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
export const updateShipmentStatus = httpsCallable(
  functions,
  "updateShipmentStatus",
);
export const updateShipmentPackageStatus = httpsCallable(
  functions,
  "updateShipmentPackageStatus",
);
export const updateShipmentPackages = httpsCallable(
  functions,
  "updateShipmentPackages",
);

// TRIPS
export const createTruckTrip = httpsCallable(functions, "createTruckTrip");
export const assignShipmentToTrip = httpsCallable(
  functions,
  "assignShipmentToTrip",
);
export const unassignShipmentFromTrip = httpsCallable(
  functions,
  "unassignShipmentFromTrip",
);

export const updateTripSchedule = httpsCallable(
  functions,
  "updateTripSchedule",
);

export const disableTruckTrip = httpsCallable(functions, "disableTruckTrip");
export const setTruckDelay = httpsCallable(functions, "setTruckDelay");
export const clearTruckDelay = httpsCallable(functions, "clearTruckDelay");
export const updateTripStatus = httpsCallable(functions, "updateTripStatus");
export const resolveDelay = httpsCallable(functions, "resolveDelayReport");

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

// SMS & COMMUNICATION
export const sendManualSms = httpsCallable(functions, "sendManualSms");
export const broadcastTripMessage = httpsCallable(
  functions,
  "broadcastTripMessage",
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
export const ensureUserPublicId = httpsCallable(functions, "ensureUserPublicId");
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
