"use strict";

const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// ✅ MUST be called once, before anything else
setGlobalOptions({ region: "asia-southeast1" });

// ✅ Admin init (idempotent)
if (!admin.apps.length) {
  admin.initializeApp();
}


/* ======================================================
   PHASE 5 + 6 — PACKAGE → TRIP → TRACKING SYNC
====================================================== */
exports.syncTripProgressFromPackages = onDocumentUpdated(
  "tracking_records/{trackingId}/truck_trips/{tripDocId}/trip_packages/{packageDocId}",
  async (event) => {
    const after = event.data.after?.data();
    if (!after) return;

    const tripRef = event.data.after.ref.parent.parent;
    if (!tripRef) return;

    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) return;

    const trip = tripSnap.data();

    // 🔄 Recalculate delivery progress
    const packagesSnap = await tripRef
      .collection("trip_packages")
      .where("active", "==", true)
      .get();

    const total = packagesSnap.size;
    const delivered = packagesSnap.docs.filter(
      (d) => d.data().status === "DELIVERED"
    ).length;

    const progress = total === 0 ? 0 : delivered / total;

    const tripUpdate = {
      packageTotal: total,
      packageDelivered: delivered,
      deliveryProgress: progress,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // ✅ Close trip if fully delivered
    if (delivered === total && total > 0) {
      tripUpdate.status = "DELIVERED";
      tripUpdate.completedAt =
        admin.firestore.FieldValue.serverTimestamp();
      tripUpdate.active = false;
    }

    await tripRef.update(tripUpdate);

    // 🔁 Phase 6 — auto-sync tracking_records
    const trackingRef = tripRef.parent.parent;
    if (trackingRef) {
      const trackingUpdate = {
        status: tripUpdate.status || trip.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (tripUpdate.status === "DELIVERED") {
        trackingUpdate.deliveredAt =
          admin.firestore.FieldValue.serverTimestamp();
      }

      await trackingRef.update(trackingUpdate);
    }
  }
);

// --------------------------------------------------
// AUTH → USER PROFILE (v1 trigger)
// --------------------------------------------------
const { auth } = require("firebase-functions/v1");

exports.createUserProfile = auth.user().onCreate(async (user) => {
  if (!user?.uid) return;

  await admin.firestore().collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || "",
      role: "user",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});

// ==================================================
// 📦 CORE SHIPPING FUNCTIONS
// ==================================================
exports.createShipment = require("./createShipment").createShipment;
exports.archiveShipment = require("./archiveShipment").archiveShipment;
exports.updateTruckStatus = require("./updateTruckStatus").updateTruckStatus;
exports.appendStatusEvent = require("./appendStatusEvent").appendStatusEvent;
exports.syncShipmentItems = require("./syncShipmentItems").syncShipmentItems;


// 🌍 PUBLIC (customer)
exports.trackShipment = require("./trackShipment").trackShipment;

// ==================================================
// 📩 SMS – MANUAL & BULK (existing endpoints)
// ==================================================
exports.sendSMS = require("./sendSMS").sendSMS;
exports.sendBulkSMS = require("./sendBulkSMS").sendBulkSMS;

// ==================================================
// 🤖 AUTO SMS (status-change driven)
// ==================================================
exports.autoSms = require("./autoSms").autoSms;

// ==================================================
// 🧠 SMS ADMIN / MANAGER CONTROLS (existing module)
// ==================================================
exports.smsAdmin = require("./smsAdmin").smsAdmin;

// ==================================================
// ✅ NEW: CALLABLES REQUIRED BY admin/shipments.js
// ==================================================

// Shipments
exports.bulkCreateShipments = require("./bulkCreateShipments").bulkCreateShipments;

// Truck trips
exports.createTruckTrip = require("./createTruckTrip").createTruckTrip;
exports.assignShipmentToTruckTrip = require("./assignShipmentToTruckTrip").assignShipmentToTruckTrip;
exports.unassignShipmentFromTruckTrip = require("./unassignShipmentFromTruckTrip").unassignShipmentFromTruckTrip;

// Truck controls
exports.setTruckDelay = require("./setTruckDelay").setTruckDelay;
exports.clearTruckDelay = require("./clearTruckDelay").clearTruckDelay;
exports.setTruckAutoSmsSettings = require("./setTruckAutoSmsSettings").setTruckAutoSmsSettings;

exports.assignDriverToTruckTrip = require("./assignDriverToTruckTrip").assignDriverToTruckTrip;
exports.unassignDriverFromTruckTrip = require("./unassignDriverFromTruckTrip").unassignDriverFromTruckTrip;

// SMS callable experience (UI preview/send + per-truck usage)
exports.previewNextSms = require("./previewNextSms").previewNextSms;
exports.previewManualSms = require("./previewManualSms").previewManualSms;
exports.sendManualSms = require("./sendManualSms").sendManualSms;
exports.getTruckSmsUsage = require("./getTruckSmsUsage").getTruckSmsUsage;

// Partial delivery
exports.recordPartialDelivery = require("./recordPartialDelivery").recordPartialDelivery;

// ==================================================
// 🔗 INVITATIONS
// ==================================================
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

exports.syncTripToTracking = onDocumentUpdated(
  "tracking_records/{trackingId}/truck_trips/{tripId}",
  async (event) => {
    const after = event.data.after?.data();
    if (!after) return;

    const trackingRef = event.data.after.ref.parent.parent;
    if (!trackingRef) return;

    const update = {
      status: after.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (after.status === "DELIVERED") {
      update.deliveredAt =
        admin.firestore.FieldValue.serverTimestamp();
    }

    await trackingRef.update(update);
  }
);
