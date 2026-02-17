import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase";

const functions = getFunctions(app, "asia-southeast1");

export const scanPackages = httpsCallable(functions, "scanPackages");
export const finishLoadingTruck = httpsCallable(
  functions,
  "finishLoadingTruck",
);
export const updateShipmentPackages = httpsCallable(
  functions,
  "updateShipmentPaackages",
);
export const updateShipmentStatus = httpsCallable(
  functions,
  "updateShipmentStatus",
);

export const startTrip = httpsCallable(functions, "startTrip");
export const reportTripDelay = httpsCallable(functions, "reportTripDelay");

// Customer helpers
export const addTrackedShipment = httpsCallable(
  functions,
  "addTrackedShipment",
);
export const bulkShipmentAction = httpsCallable(
  functions,
  "bulkShipmentAction",
);

// ----------------------------
export const bulkUpdateShipmentStatus = httpsCallable(
  functions,
  "bulkUpdateShipmentStatus",
);
