"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function canManageShipment(data, uid) {
  const visibility = Array.isArray(data.visibilityUserIds)
    ? data.visibilityUserIds
    : [];
  const createdBy = data.createdBy || data.sender?.uid || null;
  return visibility.includes(uid) || String(createdBy) === String(uid);
}

exports.customerManageShipment = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;
    const { shipmentId, action } = request.data || {};

    if (!shipmentId || typeof shipmentId !== "string") {
      throw new HttpsError("invalid-argument", "shipmentId is required.");
    }

    if (!["cancel", "removeFromHistory"].includes(action)) {
      throw new HttpsError(
        "invalid-argument",
        "action must be cancel or removeFromHistory.",
      );
    }

    const ref = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      const data = snap.data() || {};

      if (!canManageShipment(data, uid)) {
        throw new HttpsError(
          "permission-denied",
          "You cannot manage this shipment.",
        );
      }

      if (action === "cancel") {
        if (data.status !== "PENDING_PICKUP") {
          throw new HttpsError(
            "failed-precondition",
            "Only pickup requests that are still pending can be cancelled.",
          );
        }

        const now = Timestamp.now();
        const history = Array.isArray(data.statusHistory)
          ? [...data.statusHistory]
          : [];
        history.push({
          status: "CANCELLED",
          at: now,
          note: "Cancelled by customer from the mobile app.",
          location: data.sender?.address?.city || null,
        });

        tx.update(ref, {
          status: "CANCELLED",
          statusHistory: history,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        });
        return;
      }

      // removeFromHistory
      tx.update(ref, {
        visibilityUserIds: FieldValue.arrayRemove(uid),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
    });

    await db.collection("admin_logs").add({
      action:
        action === "cancel"
          ? "CUSTOMER_CANCELLED_SHIPMENT"
          : "CUSTOMER_REMOVED_SHIPMENT_VISIBILITY",
      shipmentId,
      actorId: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
