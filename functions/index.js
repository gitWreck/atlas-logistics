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
const functionsV1 = require("firebase-functions");

// ------------------------------------------------------------
// 1) GLOBAL OPTIONS + ADMIN INIT
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 2) AUTH TRIGGERS (v1 only)
// ------------------------------------------------------------
exports.createUserProfile = require("./src/users/createUserProfile");
exports.toggleUserAccount = require("./src/users/toggleUserAccount");

// ------------------------------------------------------------
// 3) HTTPS / CALLABLE FUNCTIONS
// ------------------------------------------------------------

// Users
exports.listUsers = require("./src/users/listUsers").listUsers;

// Trips
exports.createTruckTrip =
  require("./src/trips/createTruckTrip").createTruckTrip;
exports.loadItemsToTrip =
  require("./src/trips/loadItemsToTrip").loadItemsToTrip;
exports.unloadItemsFromTrip =
  require("./src/trips/unloadItemsFromTrip").unloadItemsFromTrip;
exports.completeTrip = require("./src/trips/completeTrip").completeTrip;
exports.assignShipmentToTruckTrip =
  require("./src/trips/assignShipmentToTruckTrip").assignShipmentToTruckTrip;
exports.unassignShipmentFromTruckTrip =
  require("./src/trips/unassignShipmentFromTruckTrip").unassignShipmentFromTruckTrip;
exports.setTruckDelay = require("./src/trips/setTruckDelay").setTruckDelay;
exports.clearTruckDelay =
  require("./src/trips/clearTruckDelay").clearTruckDelay;
exports.setTruckAutoSmsSettings =
  require("./src/trips/setTruckAutoSmsSettings").setTruckAutoSmsSettings;
exports.assignDriverToTruckTrip =
  require("./src/trips/assignDriverToTruckTrip").assignDriverToTruckTrip;
exports.unassignDriverFromTruckTrip =
  require("./src/trips/unassignDriverFromTruckTrip").unassignDriverFromTruckTrip;

// Shipments
exports.getListShipments =
  require("./src/shipments/getListShipments").getListShipments;
exports.createShipmentWithSequence =
  require("./src/shipments/createShipmentWithSequence").createShipmentWithSequence;
exports.archiveShipment =
  require("./src/shipments/archiveShipment").archiveShipment;
exports.appendStatusEvent =
  require("./src/shipments/appendStatusEvent").appendStatusEvent;
exports.syncShipmentItems =
  require("./src/shipments/syncShipmentItems").syncShipmentItems;
exports.bulkCreateShipments =
  require("./src/shipments/bulkCreateShipments").bulkCreateShipments;
exports.recordPartial = require("./src/shipments/recordPartial").recordPartial;
exports.recordPartialDelivery =
  require("./src/shipments/recordPartialDelivery").recordPartialDelivery;

// Manifests & Certificates
exports.generateTripManifest =
  require("./src/trips/generateTripManifest").generateTripManifest;
exports.getTripPackages =
  require("./src/trips/getTripPackages").getTripPackages;
exports.generateTripCertificate =
  require("./src/trips/generateTripCertificate").generateTripCertificate;
exports.reopenTrip = require("./src/trips/reopenTrip").reopenTrip;

// Messaging
exports.sendSMS = require("./src/messaging/sendSMS").sendSMS;
exports.sendBulkSMS = require("./src/messaging/sendBulkSMS").sendBulkSMS;
exports.autoSms = require("./src/messaging/autoSms").autoSms;
exports.smsAdmin = require("./src/messaging/smsAdmin").smsAdmin;
exports.previewNextSms =
  require("./src/messaging/previewNextSms").previewNextSms;
exports.previewManualSms =
  require("./src/messaging/previewManualSms").previewManualSms;
exports.sendManualSms = require("./src/messaging/sendManualSms").sendManualSms;
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
  require("./src/system/migrateTripsToTopLevel")
);

// ------------------------------------------------------------
// 4) FIRESTORE TRIGGERS
// ------------------------------------------------------------
exports.autoStatusSMS = require("./src/messaging/autoStatusSMS").autoStatusSMS;
exports.autoSetPublic = require("./src/tracking/autoSetPublic").autoSetPublic;
exports.autoRepairTrackingPublic =
  require("./src/tracking/autoRepairTrackingPublic").autoRepairTrackingPublic;

const {
  syncTrackingPublic,
  syncTrackingPublicHttp,
  getPublicTracking,
  syncTrackingPublicCore,
} = require("./src/tracking/syncTrackingPublic");

exports.syncTrackingPublic = syncTrackingPublic;
exports.syncTrackingPublicHttp = syncTrackingPublicHttp;
exports.getPublicTracking = getPublicTracking;

exports.autoSyncPublicOnPackageChange = onDocumentWritten(
  "truck_trips/{tripId}/trip_packages/{pkgId}",
  async () => {
    console.log("📡 Package changed — syncing public tracking");
    // await syncTrackingPublicCore();
  }
);

exports.autoSyncPublicOnTrackingChange = onDocumentWritten(
  "tracking_records/{trackingId}",
  async () => {
    console.log("📡 Tracking changed — syncing public tracking");
    // await syncTrackingPublicCore();
  }
);

exports.syncTripProgressFromPackages = onDocumentUpdated(
  "tracking_records/{trackingId}/truck_trips/{tripDocId}/trip_packages/{packageDocId}",
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    const tripRef = event.data.after.ref.parent.parent;
    if (!tripRef) return;

    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) return;

    const packagesSnap = await tripRef
      .collection("trip_packages")
      .where("active", "==", true)
      .get();
    const total = packagesSnap.size;
    const delivered = packagesSnap.docs.reduce(
      (acc, d) => acc + (d.data()?.status === "DELIVERED" ? 1 : 0),
      0
    );
    const progress = total === 0 ? 0 : delivered / total;

    await tripRef.set(
      {
        packageTotal: total,
        packageDelivered: delivered,
        deliveryProgress: progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);

exports.syncTripToTracking = onDocumentUpdated(
  "tracking_records/{trackingId}/truck_trips/{tripId}",
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    const trackingRef = event.data.after.ref.parent.parent;
    if (!trackingRef) return;

    const update = {
      status: after.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (after.status === "DELIVERED") {
      update.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await trackingRef.set(update, { merge: true });
  }
);
