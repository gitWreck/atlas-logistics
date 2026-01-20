// public/shared/callables.js
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js";
import { functions } from "/shared/firebase.js";

export const FN = Object.freeze({
  // Shipments
  createShipment: "createShipment",
  bulkCreateShipments: "bulkCreateShipments",

  // Truck trips
  createTruckTrip: "createTruckTrip",
  assignShipmentToTruckTrip: "assignShipmentToTruckTrip",
  unassignShipmentFromTruckTrip: "unassignShipmentFromTruckTrip",

  // Truck controls
  setTruckDelay: "setTruckDelay",
  clearTruckDelay: "clearTruckDelay",
  setTruckAutoSmsSettings: "setTruckAutoSmsSettings",
  assignDriverToTruckTrip: "assignDriverToTruckTrip",
  unassignDriverFromTruckTrip: "unassignDriverFromTruckTrip",

  // SMS
  previewNextSms: "previewNextSms",
  previewManualSms: "previewManualSms",
  sendManualSms: "sendManualSms",
  getTruckSmsUsage: "getTruckSmsUsage",

  // Partial delivery
  recordPartialDelivery: "recordPartialDelivery",
});

export async function callFn(name, data = {}) {
  const fn = httpsCallable(functions, name);
  try {
    const res = await fn(data);
    return res?.data;
  } catch (err) {
    const msg =
      err?.message ||
      err?.details ||
      "Callable failed. Check Functions logs + Firestore rules.";
    console.error(`[Callable:${name}]`, err);
    throw new Error(msg);
  }
}
