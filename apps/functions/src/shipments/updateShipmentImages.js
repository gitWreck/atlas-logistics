"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { updatedBy } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentImages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTHENTICATION
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    // const uid = req.auth.uid;

    // 2. INPUT VALIDATION
    const { shipmentId, type, images } = req.data;

    const { uid, role, name } = updatedBy(req);

    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }
    if (!Array.isArray(images)) {
      throw new HttpsError("invalid-argument", "Images must be an array.");
    }
    if (type !== "receipt" && type !== "delivery") {
      throw new HttpsError(
        "invalid-argument",
        "Type must be 'receipt' or 'delivery'.",
      );
    }

    // 3. REFERENCES
    const shipmentRef = db.collection("shipments").doc(shipmentId);

    // 4. TRANSACTION
    await db.runTransaction(async (tx) => {
      // ============================================================
      // PHASE 1: READS (MUST BE DONE BEFORE ANY WRITES)
      // ============================================================
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      // ============================================================
      // PHASE 2: LOGIC & WRITES
      // ============================================================

      // A. Determine which field to update
      const targetField =
        type === "receipt" ? "proofOfReceipt" : "proofOfDelivery";

      const updateData = {
        [targetField]: images,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name,
      };

      // WRITE 1: Update Main Shipment
      tx.update(shipmentRef, updateData);

      // WRITE 2: Audit Log
      writeShipmentActionLog({
        db,
        tx,
        collection: "audit_logs",
        action:
          type === "receipt"
            ? "UPDATE_RECEIPT_IMAGES"
            : "UPDATE_DELIVERY_IMAGES",
        targetCollection: "shipments",
        targetId: shipmentId,
        shipmentId,
        actorId: uid,
        actorName: name,
        actorRole: role,
        details: {
          imageCount: images.length,
          type: type,
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, type: type, count: images.length };
  },
);
