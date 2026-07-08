"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");
const { normalizePhone } = require("../utilities/phoneHelpers");
const { resolveShipmentReference } = require("../shipments/resolveShipmentReference");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Customer helper: add a tracked shipment for the current user.
 *
 * Path: users/{uid}/tracked_shipments/{trackingNumber}
 */
exports.addTrackedShipment = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["customer"]);

    if (!req.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const uid = req.auth.uid;
    const { trackingNumber, label } = req.data || {};
    const normalizedTracking = String(trackingNumber || "")
      .trim()
      .toUpperCase();

    if (!normalizedTracking) {
      throw new HttpsError(
        "invalid-argument",
        "A valid tracking number is required.",
      );
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data().active === false) {
      throw new HttpsError(
        "permission-denied",
        "Account is disabled or missing.",
      );
    }

    const shipmentSnap = await db
      .collection("shipments")
      .doc(normalizedTracking)
      .get();

    let shipmentDocId = normalizedTracking;
    let shipment = null;

    if (shipmentSnap.exists) {
      shipment = shipmentSnap.data() || {};
    } else {
      const resolved = await resolveShipmentReference(db, normalizedTracking);
      shipmentDocId = resolved.shipmentDocId;
      shipment = resolved.shipment;
    }

    if (!shipment) {
      throw new HttpsError(
        "permission-denied",
        "Shipment not found. Please check your tracking number.",
      );
    }
    const user = userSnap.data() || {};
    const recipient = shipment.recipient || {};
    const sender = shipment.sender || {};

    if (!recipient.phone || !sender.phone) {
      throw new HttpsError(
        "permission-denied",
        "Shipment is not complete. Please check your tracking number.",
      );
    }

    const userPhone = normalizePhone(user.phoneNumber || user.phone);
    const senderPhone = normalizePhone(sender.phone);
    const recipientPhone = normalizePhone(recipient.phone);

    if (!userPhone) {
      throw new HttpsError(
        "failed-precondition",
        "Please update your profile with a valid phone number to track shipments.",
      );
    }

    const isSender = userPhone === senderPhone;
    const isRecipient = userPhone === recipientPhone;

    if (!isSender && !isRecipient) {
      throw new HttpsError(
        "permission-denied",
        "You are not authorized to track this shipment. Your phone number must match the sender or receiver.",
      );
    }

    const publicSnap = await db
      .collection("tracking_public")
      .doc(shipmentDocId)
      .get();

    if (!publicSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Shipment not found. Please check your tracking number.",
      );
    }

    const trackedRef = db
      .collection("users")
      .doc(uid)
      .collection("tracked_shipments")
      .doc(shipmentDocId);

    const existingTracked = await trackedRef.get();
    if (existingTracked.exists) {
      throw new HttpsError(
        "already-exists",
        "This shipment is already in your tracked list.",
      );
    }

    await trackedRef.set(
      {
        trackingNumber: shipmentDocId,
        searchedCode: normalizedTracking,
        label: label || null,
        createdAt: FieldValue.serverTimestamp(),
        lastViewedAt: null,
        pinned: false,
      },
      { merge: true },
    );

    const shipmentUpdates = {
      visibilityUserIds: FieldValue.arrayUnion(uid),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (isSender) {
      shipmentUpdates["sender.uid"] = uid;
    }
    if (isRecipient) {
      shipmentUpdates["recipient.uid"] = uid;
    }

    await db.collection("shipments").doc(shipmentDocId).update(shipmentUpdates);

    return {
      success: true,
      trackingNumber: shipmentDocId,
      searchedCode: normalizedTracking,
    };
  },
);
