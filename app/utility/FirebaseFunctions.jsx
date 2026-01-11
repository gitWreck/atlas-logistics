import { getFunctions, httpsCallable } from "firebase/functions";
import { app as mainApp } from "@/lib/firebase";

// ⚠️ Make sure this matches your deployed region!
const functions = getFunctions(mainApp, "asia-southeast1");

// SHIPMENTS

export const sendBulkSMSCallable = httpsCallable(functions, "sendBulkSMS");
export const syncShipmentItemsCallable = httpsCallable(
  functions,
  "syncShipmentItems"
);
export const setTruckDelayCallable = httpsCallable(functions, "setTruckDelay");
export const clearTruckDelayCallable = httpsCallable(
  functions,
  "clearTruckDelay"
);
export const setTruckAutoSmsSettingsCallable = httpsCallable(
  functions,
  "setTruckAutoSmsSettings"
);
export const transitionPackageStatusCallable = httpsCallable(
  functions,
  "transitionPackageStatus"
);
export const loadItemsToTripCallable = httpsCallable(
  functions,
  "loadItemsToTrip"
);
export const unloadItemsFromTripCallable = httpsCallable(
  functions,
  "unloadItemsFromTrip"
);
export const recordPartialCallable = httpsCallable(functions, "recordPartial");
export const assignShipmentToTruckTripCallable = httpsCallable(
  functions,
  "assignShipmentToTruckTrip"
);
export const completeTripCallable = httpsCallable(functions, "completeTrip");
export const createShipmentWithSequenceCallable = httpsCallable(
  functions,
  "createShipmentWithSequence"
);

// ADMIN

export const listUsersCallable = httpsCallable(functions, "listUsers");
export const createUserProfileCallable = httpsCallable(
  getFunctions(mainApp, "us-central1"),
  "createUserProfile"
);
