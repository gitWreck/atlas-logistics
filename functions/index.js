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

exports.createUserProfile = require("./src/createUserProfile"); // Your existing trigger

exports.createUser = require("./src/createUser").createUser;

/**
 * AUTH — USER DELETED
 * Marks user profile deleted in Firestore
 */
exports.cleanupUserProfile = functionsV1.auth.user().onDelete(async (user) => {
  if (!user?.uid) return;

  await admin.firestore().collection("users").doc(user.uid).set(
    {
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("User marked deleted:", user.uid);
});

// ------------------------------------------------------------
// 3) CALLABLE / HTTPS FUNCTIONS
// ------------------------------------------------------------

const { createTruckTrip } = require("./src/createTruckTrip");
const {
  createShipmentWithSequence,
} = require("./src/createShipmentWithSequence");
const { loadItemsToTrip } = require("./src/loadItemsToTrip");
const { unloadItemsFromTrip } = require("./src/unloadItemsFromTrip");
const { completeTrip } = require("./src/completeTrip");

exports.createTruckTrip = createTruckTrip;
exports.createShipmentWithSequence = createShipmentWithSequence;
exports.loadItemsToTrip = loadItemsToTrip;
exports.unloadItemsFromTrip = unloadItemsFromTrip;
exports.completeTrip = completeTrip;

// Partial (callable)
exports.recordPartial = require("./src/recordPartial").recordPartial;

/* MANIFEST & CERTIFICATES (CALLABLES) */
exports.generateTripManifest =
  require("./generateTripManifest").generateTripManifest;
exports.getTripPackages = require("./getTripPackages").getTripPackages;
exports.generateTripCertificate =
  require("./generateTripCertificate").generateTripCertificate;
exports.reopenTrip = require("./reopenTrip").reopenTrip;

/* CORE SHIPPING FUNCTIONS (existing endpoints) */
exports.archiveShipment = require("./archiveShipment").archiveShipment;
exports.updateTruckStatus = require("./updateTruckStatus").updateTruckStatus;
exports.appendStatusEvent = require("./appendStatusEvent").appendStatusEvent;
exports.syncShipmentItems = require("./syncShipmentItems").syncShipmentItems;

// 🌍 PUBLIC (customer)
exports.trackShipment = require("./trackShipment").trackShipment;

/* SMS – MANUAL & BULK (existing endpoints) */
exports.sendSMS = require("./sendSMS").sendSMS;
exports.sendBulkSMS = require("./sendBulkSMS").sendBulkSMS;

/* 🤖 AUTO SMS (status-change driven) */
exports.autoSms = require("./autoSms").autoSms;

/* 🧠 SMS ADMIN / MANAGER CONTROLS */
exports.smsAdmin = require("./smsAdmin").smsAdmin;

/* ✅ CALLABLES REQUIRED BY admin/shipments.js */

// Shipments
exports.bulkCreateShipments =
  require("./bulkCreateShipments").bulkCreateShipments;

// Truck trips
exports.assignShipmentToTruckTrip =
  require("./assignShipmentToTruckTrip").assignShipmentToTruckTrip;
exports.unassignShipmentFromTruckTrip =
  require("./unassignShipmentFromTruckTrip").unassignShipmentFromTruckTrip;

// Truck controls
exports.setTruckDelay = require("./setTruckDelay").setTruckDelay;
exports.clearTruckDelay = require("./clearTruckDelay").clearTruckDelay;
exports.setTruckAutoSmsSettings =
  require("./setTruckAutoSmsSettings").setTruckAutoSmsSettings;

exports.assignDriverToTruckTrip =
  require("./assignDriverToTruckTrip").assignDriverToTruckTrip;
exports.unassignDriverFromTruckTrip =
  require("./unassignDriverFromTruckTrip").unassignDriverFromTruckTrip;

// SMS callable experience (UI preview/send + per-truck usage)
exports.previewNextSms = require("./previewNextSms").previewNextSms;
exports.previewManualSms = require("./previewManualSms").previewManualSms;
exports.sendManualSms = require("./sendManualSms").sendManualSms;
exports.getTruckSmsUsage = require("./getTruckSmsUsage").getTruckSmsUsage;

// Partial delivery (separate implementation)
exports.recordPartialDelivery =
  require("./recordPartialDelivery").recordPartialDelivery;

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
} = require("./invitations");
exports.createInvite = createInvite;
exports.validateInvite = validateInvite;
exports.acceptInvite = acceptInvite;
exports.revokeInvite = revokeInvite;

/* 🔁 DATA MIGRATION TOOLS (ADMIN ONLY) */
const migrateTripsToTopLevel = require("./migrateTripsToTopLevel");
exports.migrateTripsToTopLevel = onRequest(migrateTripsToTopLevel);

// ------------------------------------------------------------
// 4) FIRESTORE TRIGGERS
// ------------------------------------------------------------

const { autoStatusSMS } = require("./src/autoStatusSMS");
exports.autoStatusSMS = autoStatusSMS;

// 🌍 AUTO PUBLIC TRACKING
const { autoSetPublic } = require("./src/autoSetPublic");
exports.autoSetPublic = autoSetPublic;

exports.autoRepairTrackingPublic =
  require("./autoRepairTrackingPublic").autoRepairTrackingPublic;

const {
  syncTrackingPublic,
  syncTrackingPublicHttp,
  getPublicTracking,
} = require("./src/syncTrackingPublic");

exports.syncTrackingPublic = syncTrackingPublic;
exports.syncTrackingPublicHttp = syncTrackingPublicHttp;
exports.getPublicTracking = getPublicTracking;

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { syncTrackingPublicCore } = require("./src/syncTrackingPublic");

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
