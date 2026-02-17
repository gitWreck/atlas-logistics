"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");

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

    // 1. AUTH CHECK
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
    // Basic account guard: ensure the profile exists and is active
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

    if (!shipmentSnap.exists) {
      throw new HttpsError(
        "permission-denied",
        "Shipment not found. Please check your tracking number.",
      );
    }

    const shipment = shipmentSnap.data() || {};
    const user = userSnap.data() || {};

    const recipient = shipment.recipient || {};
    const sender = shipment.sender || {};

    // const userName = String(user.name || "").trim();
    // const userPhone = String(user.phoneNumber || user.phone || "").trim();

    // Require shipment to have complete contact details
    if (!recipient.phone || !sender.phone) {
      throw new HttpsError(
        "permission-denied",
        "Shipment is not complete. Please check your tracking number.",
      );
    }

    const normalizeName = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();

    // Normalize so +63, 63, 09... all match (Philippine numbers)
    const normalizePhone = (value) => {
      let d = String(value || "").replace(/[^\d]/g, "");
      if (d.length === 11 && d.startsWith("0")) {
        d = "63" + d.slice(1); // 09xxxxxxxxx → 639xxxxxxxxx
      } else if (d.length === 10 && d.startsWith("9")) {
        d = "63" + d; // 9xxxxxxxxx → 639xxxxxxxxx
      }
      return d;
    };

    const userPhone = normalizePhone(user.phoneNumber || user.phone);
    const senderPhone = normalizePhone(shipment.sender?.phone);
    const recipientPhone = normalizePhone(shipment.recipient?.phone);

    // If user has no phone in profile, they can't track anything strictly.
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

    // Validate that the tracking number exists in the public projection
    const publicSnap = await db
      .collection("tracking_public")
      .doc(normalizedTracking)
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
      .doc(normalizedTracking);

    // Prevent duplicates: do not allow the same trackingNumber to be added twice
    const existingTracked = await trackedRef.get();
    if (existingTracked.exists) {
      throw new HttpsError(
        "already-exists",
        "This shipment is already in your tracked list.",
      );
    }

    await trackedRef.set(
      {
        trackingNumber: normalizedTracking,
        label: label || null,
        createdAt: FieldValue.serverTimestamp(),
        lastViewedAt: null,
        pinned: false,
      },
      { merge: true },
    );

    return {
      success: true,
      trackingNumber: normalizedTracking,
    };
  },
);
