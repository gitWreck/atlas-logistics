"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PICKUP_RELATED_STATUSES = new Set(["PENDING_PICKUP", "PICKED_UP"]);
const BLOCKED_STATUSES = new Set(["DELIVERED", "CANCELLED"]);

const normalizePhone = (value) => {
  let digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = "63" + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    digits = "63" + digits;
  }
  return digits;
};

exports.requestShipmentPickup = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, user } = await requireRole(db, req, ["customer"]);
    const trackingNumber = String(req.data?.trackingNumber || "")
      .trim()
      .toUpperCase();

    if (!trackingNumber) {
      throw new HttpsError(
        "invalid-argument",
        "A valid tracking number is required.",
      );
    }

    const userPhone = normalizePhone(user.phoneNumber || user.phone);
    if (!userPhone) {
      throw new HttpsError(
        "failed-precondition",
        "Please update your profile with a valid phone number.",
      );
    }

    const shipmentRef = db.collection("shipments").doc(trackingNumber);
    const shipmentSnap = await shipmentRef.get();

    if (!shipmentSnap.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipment = shipmentSnap.data() || {};
    const currentStatus = String(shipment.status || "")
      .trim()
      .toUpperCase();
    const senderPhone = normalizePhone(shipment.sender?.phone);
    const recipientPhone = normalizePhone(shipment.recipient?.phone);

    if (!senderPhone || !recipientPhone) {
      throw new HttpsError(
        "failed-precondition",
        "Shipment is missing sender or recipient contact details.",
      );
    }

    if (userPhone !== senderPhone && userPhone !== recipientPhone) {
      throw new HttpsError(
        "permission-denied",
        "You can only request pickup for your own shipments.",
      );
    }

    if (BLOCKED_STATUSES.has(currentStatus)) {
      throw new HttpsError(
        "failed-precondition",
        "Pickup cannot be requested for this shipment status.",
      );
    }

    if (PICKUP_RELATED_STATUSES.has(currentStatus)) {
      return {
        success: true,
        trackingNumber,
        status: currentStatus,
        message: "Pickup request already active.",
      };
    }

    await shipmentRef.update({
      status: "PENDING_PICKUP",
      pickupRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      remarks: "Pickup requested by customer",
      statusHistory: FieldValue.arrayUnion({
        status: "PENDING_PICKUP",
        at: new Date(),
        by: uid,
        note: "Pickup requested by customer",
        sourceUI: "CUSTOMER_APP",
      }),
    });

    return {
      success: true,
      trackingNumber,
      status: "PENDING_PICKUP",
    };
  },
);
