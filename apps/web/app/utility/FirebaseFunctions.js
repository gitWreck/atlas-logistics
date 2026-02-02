import { getFunctions, httpsCallable } from "firebase/functions";
import { app as mainApp } from "@/lib/firebase";

// ⚠️ Make sure this matches your deployed region!
const functions = getFunctions(mainApp, "asia-southeast1");

// PACKAGES

export const createPackage = httpsCallable(functions, "createPackage");
export const createShipmentWithPackages = httpsCallable(
  functions,
  "createShipmentWithPackages",
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

// DRIVERS

export const assignDriverToTruckTrip = httpsCallable(
  functions,
  "assignDriverToTruckTrip",
);
export const unassignDriverFromTruckTrip = httpsCallable(
  functions,
  "unassignDriverFromTruckTrip",
);

// SHIPMENTS

export const generateTripManifest = httpsCallable(
  functions,
  "generateTripManifest",
);
export const generateTripCertificate = httpsCallable(
  functions,
  "generateTripCertificate",
);
export const reopenTrip = httpsCallable(functions, "reopentrip");
export const bulkAssignShipments = httpsCallable(
  functions,
  "bulkAssignShipments",
);
export const splitShipments = httpsCallable(functions, "splitShipments");
export const bulkShipmentAction = httpsCallable(
  functions,
  "bulkShipmentAction",
);

// ----------------------------

export const sendBulkSMSCallable = httpsCallable(functions, "sendBulkSMS");
export const syncShipmentItemsCallable = httpsCallable(
  functions,
  "syncShipmentItems",
);
export const setTruckDelayCallable = httpsCallable(functions, "setTruckDelay");
export const clearTruckDelayCallable = httpsCallable(
  functions,
  "clearTruckDelay",
);
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

// ADMIN

export const createUserProfile = httpsCallable(functions, "createUserProfile");
export const toggleUserStatus = httpsCallable(functions, "toggleUserStatus");
