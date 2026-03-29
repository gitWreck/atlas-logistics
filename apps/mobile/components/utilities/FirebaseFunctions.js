import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase";

const functions = getFunctions(app, "asia-southeast1");

export const scanPackages = httpsCallable(functions, "scanPackages");
export const finalizeHubProcessing = httpsCallable(
  functions,
  "finalizeHubProcessing",
);

export const updateShipmentPackages = httpsCallable(
  functions,
  "updateShipmentPackages",
);
export const updateShipmentStatus = httpsCallable(
  functions,
  "updateShipmentStatus",
);
export const updateTripStatus = httpsCallable(functions, "updateTripStatus");

export const startTrip = httpsCallable(functions, "startTrip");
export const reportTripDelay = httpsCallable(functions, "reportTripDelay");
export const reportCheckerTrip = httpsCallable(functions, "reportCheckerTrip");
export const clearTruckDelay = httpsCallable(functions, "clearTruckDelay");

// Customer helpers
export const addTrackedShipment = httpsCallable(
  functions,
  "addTrackedShipment",
);
export const requestShipmentPickup = httpsCallable(
  functions,
  "requestShipmentPickup",
);
export const bulkShipmentAction = httpsCallable(
  functions,
  "bulkShipmentAction",
);

// Messaging
export const sendManualSMS = httpsCallable(functions, "sendManualSMS");

// user actions
export const updateUserProfileMobile = httpsCallable(
  functions,
  "updateUserProfileMobile",
);
export const requestRecoveryOTP = httpsCallable(
  functions,
  "requestRecoveryOTP",
);
export const verifyRecoveryOTP = httpsCallable(functions, "verifyRecoveryOTP");
