import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { Platform } from "react-native";
import { app } from "../../firebase";
import { getCallIdentity } from "../calls/callSession";

const functions = getFunctions(app, "asia-southeast1");
const useFunctionsEmulator =
  __DEV__ &&
  process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === "true";

if (useFunctionsEmulator) {
  const emulatorHost =
    process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ||
    (Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1");
  const emulatorPort = Number(
    process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001,
  );

  try {
    connectFunctionsEmulator(functions, emulatorHost, emulatorPort);
  } catch (error) {
    // Expo Fast Refresh can evaluate this module again after the emulator has
    // already been connected. Only rethrow unexpected configuration errors.
    if (!String(error?.message || "").includes("already")) {
      throw error;
    }
  }
}

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
export const resolveShipmentByLabel = httpsCallable(
  functions,
  "resolveShipmentByLabel",
);
export const reconcileShipmentAtHub = httpsCallable(
  functions,
  "reconcileShipmentAtHub",
);
export const receiveReturnedShipmentAtHub = httpsCallable(
  functions,
  "receiveReturnedShipmentAtHub",
);
export const releaseForDeliveryOperations = httpsCallable(
  functions,
  "releaseForDeliveryOperations",
);
export const updateShipmentDetails = httpsCallable(
  functions,
  "updateShipmentDetails",
);
export const updateShipmentImages = httpsCallable(
  functions,
  "updateShipmentImages",
);
export const updateTripStatus = httpsCallable(functions, "updateTripStatus");
export const assignDriverToTrip = httpsCallable(functions, "assignDriverToTrip");
export const assignShipmentToTrip = httpsCallable(
  functions,
  "assignShipmentToTrip",
);
export const unassignShipmentFromTrip = httpsCallable(
  functions,
  "unassignShipmentFromTrip",
);
export const assignCheckerMunicipalities = httpsCallable(
  functions,
  "assignCheckerMunicipalities",
);

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
export const dispatchTrip = httpsCallable(functions, "dispatchTrip");
export const startReceiving = httpsCallable(functions, "startReceiving");
export const recoverFoundPackage = httpsCallable(functions, "recoverFoundPackage");
export const reportTripDelay = httpsCallable(functions, "reportTripDelay");
export const confirmDriverArrival = httpsCallable(functions, "confirmDriverArrival");
export const reportDriverTripIssue = httpsCallable(functions, "reportDriverTripIssue");
export const reportCheckerTrip = httpsCallable(functions, "reportCheckerTrip");
export const clearTruckDelay = httpsCallable(functions, "clearTruckDelay");
export const setTruckDelay = httpsCallable(functions, "setTruckDelay");
export const manualAssignShipmentToTrip = httpsCallable(
  functions,
  "manualAssignShipmentToTrip",
);
export const broadcastTripMessage = httpsCallable(
  functions,
  "broadcastTripMessage",
);

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
export const createShipment = httpsCallable(functions, "createShipment");
export const deleteShipment = httpsCallable(functions, "deleteShipment");
export const createTruckTrip = httpsCallable(functions, "createTruckTrip");
export const updateTripSchedule = httpsCallable(functions, "updateTripSchedule");
export const cancelTruckTrip = httpsCallable(functions, "cancelTruckTrip");
export const archiveTruckTrip = httpsCallable(functions, "archiveTruckTrip");
export const getTripAuditLog = httpsCallable(functions, "getTripAuditLog");
export const generateTripManifest = httpsCallable(
  functions,
  "generateTripManifest",
);
export const unlockTripManifest = httpsCallable(
  functions,
  "unlockTripManifest",
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
export const getManagerMobileDashboard = httpsCallable(
  functions,
  "getManagerMobileDashboard",
);
export const listManagerMobileShipments = httpsCallable(
  functions,
  "listManagerMobileShipments",
);
export const getManagerMobileShipment = httpsCallable(
  functions,
  "getManagerMobileShipment",
);
export const listManagerMobileOperations = httpsCallable(
  functions,
  "listManagerMobileOperations",
);
export const getManagerMobileTrip = httpsCallable(
  functions,
  "getManagerMobileTrip",
);
export const resolveManagerMobileTripScan = httpsCallable(
  functions,
  "resolveManagerMobileTripScan",
);
export const getManagerMobileModules = httpsCallable(
  functions,
  "getManagerMobileModules",
);
export const updateManagerMobileSettings = httpsCallable(
  functions,
  "updateManagerMobileSettings",
);
export const upsertTruck = httpsCallable(functions, "upsertTruck");
export const updateTruckStatus = httpsCallable(functions, "updateTruckStatus");
export const createInvoice = httpsCallable(functions, "createInvoice");
export const editInvoice = httpsCallable(functions, "editInvoice");
export const createUserProfile = httpsCallable(functions, "createUserProfile");
export const updateInvoiceStatus = httpsCallable(
  functions,
  "updateInvoiceStatus",
);
export const listManagerMobileNotifications = httpsCallable(
  functions,
  "listManagerMobileNotifications",
);
export const listManagerMobileConversations = httpsCallable(
  functions,
  "listManagerMobileConversations",
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
export const updateUserProfile = httpsCallable(functions, "updateUserProfile");
export const toggleUserStatus = httpsCallable(functions, "toggleUserStatus");
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
