import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase";
import { getCallIdentity } from "../calls/callSession";

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
export const updateShipmentImages = httpsCallable(
  functions,
  "updateShipmentImages",
);
export const updateTripStatus = httpsCallable(functions, "updateTripStatus");

export const loadPackagesToDeliveryManifest = httpsCallable(
  functions,
  "loadPackagesToDeliveryManifest",
);
export const reportFailedDelivery = httpsCallable(
  functions,
  "reportFailedDelivery",
);
export const returnPackagesToWarehouse = httpsCallable(
  functions,
  "returnPackagesToWarehouse",
);
export const getShipmentCustodyTimeline = httpsCallable(
  functions,
  "getShipmentCustodyTimeline",
);

export const startTrip = httpsCallable(functions, "startTrip");
export const reportTripDelay = httpsCallable(functions, "reportTripDelay");
export const confirmDriverArrival = httpsCallable(functions, "confirmDriverArrival");
export const reportDriverTripIssue = httpsCallable(functions, "reportDriverTripIssue");
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
export const getMyInvoices = httpsCallable(functions, "getMyInvoices");
export const getMySchedules = httpsCallable(functions, "getMySchedules");
export const bulkShipmentAction = httpsCallable(
  functions,
  "bulkShipmentAction",
);

// Messaging
export const sendManualSMS = httpsCallable(functions, "sendManualSMS");
export const createConversation = httpsCallable(
  functions,
  "createConversation",
);
export const listCheckerChatContacts = httpsCallable(
  functions,
  "listCheckerChatContacts",
);
export const createCheckerConversation = httpsCallable(
  functions,
  "createCheckerConversation",
);
export const listDriverChatContacts = httpsCallable(
  functions,
  "listDriverChatContacts",
);
export const createDriverConversation = httpsCallable(
  functions,
  "createDriverConversation",
);
export const listStaffChatContacts = httpsCallable(
  functions,
  "listStaffChatContacts",
);
export const createStaffConversation = httpsCallable(
  functions,
  "createStaffConversation",
);
export const createCallHistoryMessage = httpsCallable(
  functions,
  "createCallHistoryMessage",
);
export const sendChatMessage = httpsCallable(functions, "sendChatMessage");
export const getCustomerContactForShipment = httpsCallable(
  functions,
  "getCustomerContactForShipment",
);
export const getOrCreateShipmentConversation = httpsCallable(
  functions,
  "getOrCreateShipmentConversation",
);
export const markConversationRead = httpsCallable(
  functions,
  "markConversationRead",
);
const startConversationCallCallable = httpsCallable(functions, "startConversationCall");
const updateConversationCallStatusCallable = httpsCallable(functions, "updateConversationCallStatus");
const acceptConversationCallCallable = httpsCallable(functions, "acceptConversationCall");
const heartbeatConversationCallCallable = httpsCallable(functions, "heartbeatConversationCall");
const endCurrentCallSessionCallable = httpsCallable(functions, "endCurrentCallSession");

async function withCallIdentity(payload = {}) {
  return { ...payload, ...(await getCallIdentity()) };
}

export const startConversationCall = async (payload) =>
  startConversationCallCallable(await withCallIdentity(payload));
export const updateConversationCallStatus = async (payload) =>
  updateConversationCallStatusCallable(await withCallIdentity(payload));
export const acceptConversationCall = async (payload) =>
  acceptConversationCallCallable(await withCallIdentity(payload));
export const heartbeatConversationCall = async (payload) =>
  heartbeatConversationCallCallable(await withCallIdentity(payload));
export const endCurrentCallSession = async (payload = {}) =>
  endCurrentCallSessionCallable(await withCallIdentity(payload));
export const generateTencentUserSig = httpsCallable(
  functions,
  "generateTencentUserSig",
);

// user actions
export const updateUserProfileMobile = httpsCallable(
  functions,
  "updateUserProfileMobile",
);
export const updateUserThemePreference = httpsCallable(
  functions,
  "updateUserThemePreference",
);
export const deleteMyAccount = httpsCallable(functions, "deleteMyAccount");
export const ensureUserPublicId = httpsCallable(
  functions,
  "ensureUserPublicId",
);
export const requestRecoveryOTP = httpsCallable(
  functions,
  "requestRecoveryOTP",
);
export const verifyRecoveryOTP = httpsCallable(functions, "verifyRecoveryOTP");
