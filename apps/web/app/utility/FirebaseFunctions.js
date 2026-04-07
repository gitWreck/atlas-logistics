import { getFunctions, httpsCallable } from "firebase/functions";
import { app as mainApp } from "@/lib/firebase";

// ⚠️ Make sure this matches your deployed region!
const functions = getFunctions(mainApp, "asia-southeast1");

// PACKAGES
// export const createPackage = httpsCallable(functions, "createPackage");
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
export const updatePackageStatus = httpsCallable(
  functions,
  "updatePackageStatus",
);

export const updateShipmentPackages = httpsCallable(
  functions,
  "updateShipmentPackages",
);

// TRIPS
export const createTruckTrip = httpsCallable(functions, "createTruckTrip");
export const assignShipmentToTruckTrip = httpsCallable(
  functions,
  "assignShipmentToTruckTrip",
);
export const unassignShipmentFromTruckTrip = httpsCallable(
  functions,
  "unassignShipmentFromTruckTrip",
);
export const disableTruckTrip = httpsCallable(functions, "disableTruckTrip");
export const setTruckDelay = httpsCallable(functions, "setTruckDelay");
export const clearTruckDelay = httpsCallable(functions, "clearTruckDelay");
export const updateTripStatus = httpsCallable(functions, "updateTripStatus");
export const resolveDelay = httpsCallable(functions, "resolveDelayReport");

// DRIVERS
// export const assignDriverToTruckTrip = httpsCallable(
//   functions,
//   "assignDriverToTruckTrip",
// );
// export const unassignDriverFromTruckTrip = httpsCallable(
//   functions,
//   "unassignDriverFromTruckTrip",
// );
export const removeAssignmentFromTruckTrip = httpsCallable(
  functions,
  "removeAssignmentFromTruckTrip",
);
export const assignmentToTruckTrip = httpsCallable(
  functions,
  "assignmentToTruckTrip",
);

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

// ADMIN
export const createUserProfile = httpsCallable(functions, "createUserProfile");
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
