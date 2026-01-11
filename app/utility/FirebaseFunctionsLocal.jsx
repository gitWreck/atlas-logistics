import { getFunctions } from "firebase/functions";
import { connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { app as mainApp } from "@/lib/firebase";

const functions = getFunctions(mainApp, "asia-southeast1");
connectFunctionsEmulator(functions, "localhost", 5001);

// shipments

export const createShipmentWithSequence = httpsCallable(
  functions,
  "createShipmentWithSequence"
);
export const getListShipments = httpsCallable(functions, "getListShipments");

// users and admin actions

export const createUserProfile = httpsCallable(
  getFunctions(mainApp, "us-central1"),
  "createUserProfile"
);
export const listUsers = httpsCallable(functions, "listUsers");
