"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

function normalizeCode(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Resolve a shipment document from a Firestore doc id, public shipmentId, or package label.
 */
async function resolveShipmentReference(db, rawCode = "") {
  const code = normalizeCode(rawCode);
  if (!code) {
    throw new HttpsError("invalid-argument", "Shipment or package label is required.");
  }

  const directSnap = await db.collection("shipments").doc(code).get();
  if (directSnap.exists) {
    return {
      shipmentDocId: directSnap.id,
      shipment: directSnap.data() || {},
      matchedBy: "document_id",
      packageLabel: null,
    };
  }

  const byBarcodeSnap = await db
    .collection("shipments")
    .where("packageBarcodes", "array-contains", code)
    .limit(1)
    .get();

  if (!byBarcodeSnap.empty) {
    const docSnap = byBarcodeSnap.docs[0];
    return {
      shipmentDocId: docSnap.id,
      shipment: docSnap.data() || {},
      matchedBy: "package_label",
      packageLabel: code,
    };
  }

  const byPublicIdSnap = await db
    .collection("shipments")
    .where("shipmentId", "==", code)
    .limit(1)
    .get();

  if (!byPublicIdSnap.empty) {
    const docSnap = byPublicIdSnap.docs[0];
    return {
      shipmentDocId: docSnap.id,
      shipment: docSnap.data() || {},
      matchedBy: "shipment_id",
      packageLabel: null,
    };
  }

  throw new HttpsError(
    "not-found",
    `No shipment found for "${code}". Use a shipment ID or package label (e.g. AT-…-01).`,
  );
}

module.exports = {
  normalizeCode,
  resolveShipmentReference,
};
