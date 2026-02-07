"use strict";

const { setGlobalOptions } = require("firebase-functions/v2/options");
const {
  onCall,
  onRequest,
  HttpsError,
} = require("firebase-functions/v2/https");
const {
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

setGlobalOptions({
  region: "asia-southeast1",
  cors: [
    "http://localhost:3000",
    "https://atlas-tracking.web.app",
    "https://atlas-tracking.firebaseapp.com",
  ],
});

if (!admin.apps.length) {
  admin.initializeApp();
}

// admin actions
exports.createUserProfile =
  require("./src/users/createUserProfile").createUserProfile;
exports.toggleUserStatus = require("./src/users/toggleUserStatus");
exports.addTrackedShipment =
  require("./src/users/addTrackedShipment").addTrackedShipment;

// packages
// exports.createPackage = require("./src/packages/createPackage").createPackage;
exports.createShipmentWithPackages =
  require("./src/shipments/createShipmentWithPackages").createShipmentWithPackages;
exports.scanPackages = require("./src/packages/scanPackages").scanPackages;
exports.updateShipmentPackages =
  require("./src/packages/updateShipmentPackages").updateShipmentPackages;

// ------------------------------------------
// Trips
exports.createTruckTrip =
  require("./src/trips/createTruckTrip").createTruckTrip;
exports.assignShipmentToTruckTrip =
  require("./src/trips/assignShipmentToTruckTrip").assignShipmentToTruckTrip;
exports.unassignShipmentFromTruckTrip =
  require("./src/trips/unassignShipmentFromTruckTrip").unassignShipmentFromTruckTrip;

exports.startTrip = require("./src/trips/startTrip").startTrip;

exports.reportTripDelay =
  require("./src/trips/reportTripDelay").reportTripDelay;
exports.setTruckDelay = require("./src/trips/setTruckDelay").setTruckDelay;
exports.clearTruckDelay =
  require("./src/trips/clearTruckDelay").clearTruckDelay;
exports.resolveDelayReport =
  require("./src/trips/resolveDelayReport").resolveDelayReport;

exports.assignDriverToTruckTrip =
  require("./src/trips/assignDriverToTruckTrip").assignDriverToTruckTrip;
exports.unassignDriverFromTruckTrip =
  require("./src/trips/unassignDriverFromTruckTrip").unassignDriverFromTruckTrip;
exports.setTruckAutoSmsSettings =
  require("./src/messaging/setTruckAutoSmsSettings").setTruckAutoSmsSettings;

exports.disableTruckTrip =
  require("./src/trips/disableTruckTrip").disableTruckTrip;
exports.completeTrip = require("./src/trips/completeTrip").completeTrip;
exports.unlockTripManifest =
  require("./src/trips/unlockTripManiefest").unlockTripManifest;
exports.updateTripStatus =
  require("./src/trips/updateTripStatus").updateTripStatus;

// Shipments
exports.bulkAssignShipments =
  require("./src/shipments/bulkAssignShipments").bulkAssignShipments;
exports.bulkUpdateShipmentStatus =
  require("./src/shipments/bulkUpdateShipmentStatus").bulkUpdateShipmentStatus;
exports.bulkShipmentAction =
  require("./src/shipments/bulkShipmentAction").bulkShipmentAction;
exports.splitShipments =
  require("./src/shipments/splitShipments").splitShipment;
exports.updateShipmentStatus =
  require("./src/shipments/updateShipmentStatus").updateShipmentStatus;
exports.finishLoadingTruck =
  require("./src/trips/finishLoadingTruck").finishLoadingTruck;

// Manifests & Certificates
exports.generateTripManifest =
  require("./src/trips/generateTripManifest").generateTripManifest;

// Messaging
exports.sendManualSms = require("./src/messaging/sendManualSms").sendManualSms;
exports.broadcastTripMessage =
  require("./src/messaging/broadcastTripMessage").broadcastTripMessage;

// Firestore Triggers
const {
  mirrorShipmentToPublic,
  syncTrackingPublicHttp,
  propagateTripUpdates,
} = require("./src/tracking/syncTrackingPublic");

exports.mirrorShipmentToPublic = mirrorShipmentToPublic;
exports.syncTrackingPublicHttp = syncTrackingPublicHttp;
exports.propagateTripUpdates = propagateTripUpdates;

// -------------------------------

// Shipments
// exports.getListShipments =
//   require("./src/shipments/getListShipments").getListShipments;
exports.createShipmentWithSequence =
  require("./src/shipments/backup/createShipmentWithSequence-orig").createShipmentWithSequence;
exports.archiveShipment =
  require("./src/shipments/archiveShipment").archiveShipment;
exports.appendStatusEvent =
  require("./src/shipments/appendStatusEvent").appendStatusEvent;
exports.syncShipmentItems =
  require("./src/shipments/syncShipmentItems").syncShipmentItems;
// exports.bulkCreateShipments =
//   require("./src/shipments/bulkCreateShipments").bulkCreateShipments;
exports.recordPartial = require("./src/shipments/recordPartial").recordPartial;
exports.recordPartialDelivery =
  require("./src/shipments/recordPartialDelivery").recordPartialDelivery;

// exports.getTripPackages =
//   require("./src/trips/backup/getTripPackages").getTripPackages;
exports.generateTripCertificate =
  require("./src/trips/generateTripCertificate").generateTripCertificate;
exports.reopenTrip = require("./src/trips/reopenTrip").reopenTrip;

exports.sendSMS = require("./src/messaging/sendSMS").sendSMS;
exports.sendBulkSMS = require("./src/messaging/sendBulkSMS").sendBulkSMS;
exports.autoSms = require("./src/messaging/autoSms").autoSms;
exports.smsAdmin = require("./src/messaging/smsAdmin").smsAdmin;
exports.previewNextSms =
  require("./src/messaging/previewNextSms").previewNextSms;
exports.previewManualSms =
  require("./src/messaging/previewManualSms").previewManualSms;
exports.getTruckSmsUsage =
  require("./src/messaging/getTruckSmsUsage").getTruckSmsUsage;

// Tracking
exports.trackShipment = require("./src/shipments/trackShipment").trackShipment;
exports.relinkPackageToTracking = onCall(async (request) => {
  const { tripDocId, pkgDocId, trackingDocId } = request.data || {};
  if (!tripDocId || !pkgDocId || !trackingDocId) {
    throw new HttpsError("invalid-argument", "Missing parameters");
  }
  await admin
    .firestore()
    .collection("truck_trips")
    .doc(tripDocId)
    .collection("trip_packages")
    .doc(pkgDocId)
    .update({ trackingDocId });
  return { success: true };
});

// Invitations
exports.createInvite = require("./src/system/invitations").createInvite;
exports.validateInvite = require("./src/system/invitations").validateInvite;
exports.acceptInvite = require("./src/system/invitations").acceptInvite;
exports.revokeInvite = require("./src/system/invitations").revokeInvite;

// Migration
exports.migrateTripsToTopLevel = onRequest(
  require("./src/system/migrateTripsToTopLevel"),
);

// ------------------------------------------------------------
// 4) FIRESTORE TRIGGERS
// ------------------------------------------------------------
exports.autoStatusSMS = require("./src/messaging/autoStatusSMS").autoStatusSMS;
