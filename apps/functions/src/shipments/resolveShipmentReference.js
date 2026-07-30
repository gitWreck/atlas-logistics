"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeCode(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Piece labels like AT-...-SHP-583090-01 → parent AT-...-SHP-583090 */
function deriveParentShipmentCode(code = "") {
  const normalized = normalizeCode(code);
  const match = normalized.match(/^(.*)-(\d{2})$/);
  return match ? match[1] : null;
}

/**
 * Resolve a shipment document from a Firestore doc id, public shipmentId, or package label.
 */
async function resolveShipmentReference(dbInstance, rawCode = "") {
  const code = normalizeCode(rawCode);
  if (!code) {
    throw new HttpsError("invalid-argument", "Shipment or package label is required.");
  }

  const directSnap = await dbInstance.collection("shipments").doc(code).get();
  if (directSnap.exists) {
    return {
      shipmentDocId: directSnap.id,
      shipment: directSnap.data() || {},
      matchedBy: "document_id",
      packageLabel: null,
    };
  }

  const parentCode = deriveParentShipmentCode(code);
  if (parentCode) {
    const parentSnap = await dbInstance
      .collection("shipments")
      .doc(parentCode)
      .get();
    if (parentSnap.exists) {
      return {
        shipmentDocId: parentSnap.id,
        shipment: parentSnap.data() || {},
        matchedBy: "parent_document_id",
        packageLabel: code,
      };
    }
  }

  const byBarcodeSnap = await dbInstance
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

  const byPublicIdSnap = await dbInstance
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

/**
 * Callable used by offline deliver sync when the client cannot resolve a label.
 * Uses Admin SDK (same reliability as load sync packageId resolution).
 */
const resolveShipmentByLabel = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireAuth(req);
    const code = normalizeCode(req.data?.code || req.data?.barcode || "");
    if (!code) {
      throw new HttpsError(
        "invalid-argument",
        "Provide a shipment or package label.",
      );
    }

    const resolved = await resolveShipmentReference(db, code);
    return {
      shipmentId: resolved.shipmentDocId,
      matchedBy: resolved.matchedBy,
      packageLabel: resolved.packageLabel,
    };
  },
);

module.exports = {
  normalizeCode,
  deriveParentShipmentCode,
  resolveShipmentReference,
  resolveShipmentByLabel,
};
