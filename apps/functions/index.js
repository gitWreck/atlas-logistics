"use strict";

const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

setGlobalOptions({
  region: "asia-southeast1",
  cors: [
    "http://localhost:3000",
    "https://atlas-tracking.web.app",
    "https://atlas-tracking.firebaseapp.com",
    "https://atlas-trucking-platform.vercel.app",
  ],
});

if (!admin.apps.length) {
  admin.initializeApp();
}

// admin actions
exports.createUserProfile =
  require("./src/users/createUserProfile").createUserProfile;
exports.ensureUserPublicId =
  require("./src/users/createUserProfile").ensureUserPublicId;
exports.updateUserProfile =
  require("./src/users/updateUserProfile").updateUserProfile;
exports.toggleUserStatus =
  require("./src/users/toggleUserStatus").toggleUserStatus;
exports.addTrackedShipment =
  require("./src/users/addTrackedShipment").addTrackedShipment;
exports.requestShipmentPickup =
  require("./src/users/requestShipmentPickup").requestShipmentPickup;
exports.resolveDelayReport =
  require("./src/trips/resolveDelayReport").resolveDelayReport;

// user actions
exports.updateUserProfileMobile =
  require("./src/users/updateUserProfileMobile").updateUserProfileMobile;
exports.updateUserThemePreference =
  require("./src/users/updateUserThemePreference").updateUserThemePreference;
exports.deleteMyAccount =
  require("./src/users/deleteMyAccount").deleteMyAccount;
exports.requestRecoveryOTP = require("./src/users/recovery").requestRecoveryOTP;
exports.verifyRecoveryOTP = require("./src/users/recovery").verifyRecoveryOTP;

// ------------------------------------------

// packages
exports.createShipment =
  require("./src/shipments/createShipment").createShipment;
exports.updateShipmentStatus =
  require("./src/shipments/updateShipmentStatus").updateShipmentStatus;
exports.updatePackageStatus =
  require("./src/packages/updatePackageStatus").updatePackageStatus;
exports.updateShipmentPackages =
  require("./src/packages/updateShipmentPackages").updateShipmentPackages;
exports.scanPackages = require("./src/packages/scanPackages").scanPackages;

// ------------------------------------------
// Trips
exports.createTruckTrip =
  require("./src/trips/createTruckTrip").createTruckTrip;

exports.startTrip = require("./src/trips/startTrip").startTrip;
exports.reportTripDelay =
  require("./src/trips/reportTripDelay").reportTripDelay;
exports.setTruckDelay = require("./src/trips/setTruckDelay").setTruckDelay;
exports.clearTruckDelay =
  require("./src/trips/clearTruckDelay").clearTruckDelay;

exports.reportCheckerTrip =
  require("./src/trips/reportCheckerTrip").reportCheckerTrip;

exports.assignShipmentToTrip =
  require("./src/trips/assignShipmentToTrip").assignShipmentToTrip;
exports.unassignShipmentFromTrip =
  require("./src/trips/unassignShipmentFromTrip").unassignShipmentFromTrip;
exports.assignDriverToTrip =
  require("./src/trips/assignDriverToTrip").assignDriverToTrip;
exports.unassignDriverFromTrip =
  require("./src/trips/unassignDriverFromTrip").unassignDriverFromTrip;
exports.assignmentToTrip =
  require("./src/trips/assignmentToTrip").assignmentToTrip;
exports.removeAssignmentFromTrip =
  require("./src/trips/removeAssignmentFromTrip").removeAssignmentFromTrip;

exports.disableTruckTrip =
  require("./src/trips/disableTruckTrip").disableTruckTrip;
exports.completeTrip = require("./src/trips/completeTrip").completeTrip;
exports.updateTripStatus =
  require("./src/trips/updateTripStatus").updateTripStatus;
exports.updateTripDetails =
  require("./src/trips/updateTripDetails").updateTripDetails;
exports.finalizeTripUnloadHandoff =
  require("./src/trips/finalizeTripUnloadHandoff").finalizeTripUnloadHandoff;
exports.finalizeTripUnloadReadyForDelivery =
  require("./src/trips/finalizeTripUnloadHandoff").finalizeTripUnloadReadyForDelivery;

// Shipments
exports.bulkShipmentAction =
  require("./src/shipments/bulkShipmentAction").bulkShipmentAction;
exports.bulkAssignShipments =
  require("./src/shipments/bulkAssignShipments").bulkAssignShipments;
exports.bulkUpdateShipmentStatus =
  require("./src/shipments/bulkUpdateShipmentStatus").bulkUpdateShipmentStatus;
exports.splitShipments =
  require("./src/shipments/splitShipments").splitShipments;
exports.finalizeHubProcessing =
  require("./src/trips/finalizeHubProcessing").finalizeHubProcessing;
exports.updateShipmentDetails =
  require("./src/shipments/updateShipmentDetails").updateShipmentDetails;
exports.updateShipmentImages =
  require("./src/shipments/updateShipmentImages").updateShipmentImages;

// Manifests & Certificates
exports.generateTripManifest =
  require("./src/trips/generateTripManifest").generateTripManifest;
exports.verifyTripManifest =
  require("./src/trips/verifyTripManifest").verifyTripManifest;
exports.unlockTripManifest =
  require("./src/trips/unlockTripManifest").unlockTripManifest;

// Invoices
exports.createInvoice = require("./src/invoices/createInvoice").createInvoice;
exports.editInvoice = require("./src/invoices/editInvoice").editInvoice;
exports.updateInvoiceStatus =
  require("./src/invoices/updateInvoiceStatus").updateInvoiceStatus;

// Messaging
exports.sendManualSms = require("./src/messaging/sendManualSms").sendManualSms;
exports.broadcastTripMessage =
  require("./src/messaging/broadcastTripMessage").broadcastTripMessage;
exports.processNotificationEvent =
  require("./src/notifications/processNotificationEvent").processNotificationEvent;

// Chat
exports.createConversation =
  require("./src/chat/conversations").createConversation;
exports.sendChatMessage = require("./src/chat/conversations").sendChatMessage;
exports.markConversationRead =
  require("./src/chat/conversations").markConversationRead;
exports.updateConversationStatus =
  require("./src/chat/conversations").updateConversationStatus;
exports.assignConversation =
  require("./src/chat/conversations").assignConversation;

// Firestore Triggers
const {
  mirrorShipmentToPublic,
  syncTrackingPublicHttp,
  propagateTripUpdates,
} = require("./src/tracking/syncTrackingPublic");
const { reportCheckerTrip } = require("./src/trips/reportCheckerTrip");
exports.reportCheckerTrip = reportCheckerTrip;

exports.mirrorShipmentToPublic = mirrorShipmentToPublic;
exports.syncTrackingPublicHttp = syncTrackingPublicHttp;
exports.propagateTripUpdates = propagateTripUpdates;

// Trucks
exports.upsertTruck = require("./src/trucks/handleTruck").upsertTruck;
exports.updateTruckStatus =
  require("./src/trucks/handleTruck").updateTruckStatus;

// -------------------------------
