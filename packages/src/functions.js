import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

export const functions = getFunctions(app, "asia-southeast1");

export const sendBulkSMSCallable = httpsCallable(functions, "sendBulkSMS");
