"use strict";

/**
 * functions/index.js
 * ------------------------------------------------------------
 * ✅ 10/10 canonical structure:
 *   1) Global options + Admin init
 *   2) AUTH TRIGGERS (v1 only)
 *   3) CALLABLE/HTTPS exports
 *   4) FIRESTORE TRIGGERS exports
 *
 * Notes:
 * - Auth triggers are STILL v1: functions.auth.user().onCreate / onDelete
 * - Everything else can be v2
 */

const { setGlobalOptions } = require("firebase-functions/v2/options");
const {
  onCall,
  onRequest,
  HttpsError,
} = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// ✅ AUTH triggers MUST use v1
const functionsV1 = require("firebase-functions");

// ------------------------------------------------------------
// 1) GLOBAL OPTIONS + ADMIN INIT
// ------------------------------------------------------------
setGlobalOptions({
  region: "asia-southeast1",
  cors: [
    "https://atlas-tracking.web.app",
    "https://atlas-tracking.firebaseapp.com",
  ],
});

// Admin SDK (idempotent)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ------------------------------------------------------------
// 2) AUTH TRIGGERS (V1 ONLY)
// ------------------------------------------------------------

// exports.createUser = require("./src/createUser").createUser; // test
exports.createUserProfile = require("./src/users/createUserProfile");
exports.toggleUserAccount = require("./src/users/toggleUserAccount");
// src/index.js
const { listUsers } = require("./src/users/listUsers"); // Destructure if you used exports.listUsers
exports.listUsers = listUsers;

// ------------------------------------------------------------
// 3) CALLABLE / HTTPS FUNCTIONS
// ------------------------------------------------------------

const { createTruckTrip } = require("./src/trips/createTruckTrip");
const {
  createShipmentWithSequence,
} = require("./src/shipments/createShipmentWithSequence");
const { loadItemsToTrip } = require("./src/trips/loadItemsToTrip");
const { unloadItemsFromTrip } = require("./src/trips/unloadItemsFromTrip");
const { completeTrip } = require("./src/trips/completeTrip");

exports.createTruckTrip = createTruckTrip;
exports.createShipmentWithSequence = createShipmentWithSequence;
exports.loadItemsToTrip = loadItemsToTrip;
exports.unloadItemsFromTrip = unloadItemsFromTrip;
exports.completeTrip = completeTrip;

// Partial (callable)
exports.recordPartial = require("./src/shipments/recordPartial").recordPartial;

/* MANIFEST & CERTIFICATES (CALLABLES) */
exports.generateTripManifest =
  require("./src/trips/generateTripManifest").generateTripManifest;
exports.getTripPackages =
  require("./src/trips/getTripPackages").getTripPackages;
exports.generateTripCertificate =
  require("./src/trips/generateTripCertificate").generateTripCertificate;
exports.reopenTrip = require("./src/trips/reopenTrip").reopenTrip;

/* CORE SHIPPING FUNCTIONS (existing endpoints) */
exports.archiveShipment =
  require("./src/shipments/archiveShipment").archiveShipment;
exports.updateTruckStatus =
  require("./src/trips/updateTruckStatus").updateTruckStatus;
exports.appendStatusEvent =
  require("./src/shipments/appendStatusEvent").appendStatusEvent;
exports.syncShipmentItems =
  require("./src/shipments/syncShipmentItems").syncShipmentItems;

// 🌍 PUBLIC (customer)
exports.trackShipment = require("./src/shipments/trackShipment").trackShipment;

/* SMS – MANUAL & BULK (existing endpoints) */
exports.sendSMS = require("./src/messaging/sendSMS").sendSMS;
exports.sendBulkSMS = require("./src/messaging/sendBulkSMS").sendBulkSMS;

exports.autoSms =
  require("./src/messaging/autoSms").autoSms; /* 🤖 AUTO SMS (status-change driven) */
exports.smsAdmin =
  require("./src/messaging/smsAdmin").smsAdmin; /* 🧠 SMS ADMIN / MANAGER CONTROLS */

/* ✅ CALLABLES REQUIRED BY admin/shipments.js */

// Shipments
exports.bulkCreateShipments =
  require("./src/shipments/bulkCreateShipments").bulkCreateShipments;

// Truck trips
exports.assignShipmentToTruckTrip =
  require("./src/trips/assignShipmentToTruckTrip").assignShipmentToTruckTrip;
exports.unassignShipmentFromTruckTrip =
  require("./src/trips/unassignShipmentFromTruckTrip").unassignShipmentFromTruckTrip;

// Truck controls
exports.setTruckDelay = require("./src/trips/setTruckDelay").setTruckDelay;
exports.clearTruckDelay =
  require("./src/trips/clearTruckDelay").clearTruckDelay;
exports.setTruckAutoSmsSettings =
  require("./src/trips/setTruckAutoSmsSettings").setTruckAutoSmsSettings;

exports.assignDriverToTruckTrip =
  require("./src/trips/assignDriverToTruckTrip").assignDriverToTruckTrip;
exports.unassignDriverFromTruckTrip =
  require("./src/trips/unassignDriverFromTruckTrip").unassignDriverFromTruckTrip;

// SMS callable experience (UI preview/send + per-truck usage)
exports.previewNextSms =
  require("./src/messaging/previewNextSms").previewNextSms;
exports.previewManualSms =
  require("./src/messaging/previewManualSms").previewManualSms;
exports.sendManualSms = require("./src/messaging/sendManualSms").sendManualSms;
exports.getTruckSmsUsage =
  require("./src/messaging/getTruckSmsUsage").getTruckSmsUsage;

// Partial delivery (separate implementation)
exports.recordPartialDelivery =
  require("./src/shipments/recordPartialDelivery").recordPartialDelivery;

// 🔧 Repair tool — relink broken package → tracking
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

/* 🔗 INVITATIONS */
const {
  createInvite,
  validateInvite,
  acceptInvite,
  revokeInvite,
} = require("./src/system/invitations");
exports.createInvite = createInvite;
exports.validateInvite = validateInvite;
exports.acceptInvite = acceptInvite;
exports.revokeInvite = revokeInvite;

/* 🔁 DATA MIGRATION TOOLS (ADMIN ONLY) */
const migrateTripsToTopLevel = require("./src/system/migrateTripsToTopLevel");
exports.migrateTripsToTopLevel = onRequest(migrateTripsToTopLevel);

// ------------------------------------------------------------
// 4) FIRESTORE TRIGGERS
// ------------------------------------------------------------

const { autoStatusSMS } = require("./src/messaging/autoStatusSMS");
exports.autoStatusSMS = autoStatusSMS;

// 🌍 AUTO PUBLIC TRACKING
const { autoSetPublic } = require("./src/tracking/autoSetPublic");
exports.autoSetPublic = autoSetPublic;

exports.autoRepairTrackingPublic =
  require("./src/tracking/autoRepairTrackingPublic").autoRepairTrackingPublic;

const {
  syncTrackingPublic,
  syncTrackingPublicHttp,
  getPublicTracking,
} = require("./src/tracking/syncTrackingPublic");

exports.syncTrackingPublic = syncTrackingPublic;
exports.syncTrackingPublicHttp = syncTrackingPublicHttp;
exports.getPublicTracking = getPublicTracking;

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { syncTrackingPublicCore } = require("./src/tracking/syncTrackingPublic");

exports.autoSyncPublicOnPackageChange = onDocumentWritten(
  "truck_trips/{tripId}/trip_packages/{pkgId}",
  async (event) => {
    console.log("📡 Package changed — syncing public tracking");
    await syncTrackingPublicCore();
  }
);

exports.autoSyncPublicOnTrackingChange = onDocumentWritten(
  "tracking_records/{trackingId}",
  async (event) => {
    console.log("📡 Tracking changed — syncing public tracking");
    await syncTrackingPublicCore();
  }
);

/**
 * PHASE 5 — PACKAGE → TRIP rollup (deliveryProgress)
 * Recalculates totals and progress on ANY package update
 * ❌ Never auto-close trip here
 */
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

    const delivered = packagesSnap.docs.reduce((acc, d) => {
      const p = d.data();
      return acc + (p?.status === "DELIVERED" ? 1 : 0);
    }, 0);

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

/**
 * PHASE 6 — TRIP → TRACKING SYNC (Status mirror)
 * Mirrors trip.status into parent tracking_records status
 * Adds deliveredAt when DELIVERED
 */
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

/**
 * AUTH — USER CREATED
 * Automatically creates user profile in Firestore
 */
// exports.createUserProfile = functionsV1.auth.user().onCreate(async (user) => {
//   if (!user?.uid) return;

//   await admin.firestore().collection("users").doc(user.uid).set(
//     {
//       uid: user.uid,
//       email: user.email || "",
//       name: user.displayName || "",
//       role: "user",
//       active: true,
//       photoURL: user.photoURL || null,
//       provider: user.providerData?.[0]?.providerId || "password",
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       lastAuthAt: admin.firestore.FieldValue.serverTimestamp(),
//     },
//     { merge: true }
//   );
// });

/**
 * AUTH — USER DELETED
 * Marks user profile deleted in Firestore
 */
// exports.cleanupUserProfile = functionsV1.auth.user().onDelete(async (user) => {
//   if (!user?.uid) return;

//   await admin.firestore().collection("users").doc(user.uid).set(
//     {
//       deleted: true,
//       deletedAt: admin.firestore.FieldValue.serverTimestamp(),
//     },
//     { merge: true }
//   );

//   console.log("User marked deleted:", user.uid);
// });
