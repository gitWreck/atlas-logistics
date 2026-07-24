"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const {
  assertEligibleForHubReconcile,
  getExpectedPieceCount,
} = require("./hubReconcileEligibility");
const { canAccessRecord } = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseNonNegativeInt(value, fieldName) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a non-negative whole number.`,
    );
  }
  return num;
}

exports.reconcileShipmentAtHub = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireRole(db, req, ["admin", "manager"]);

    const { uid: actorUid, name: actorName, role: actorRole } = updatedBy(req);
    const {
      shipmentId,
      expectedQty = null,
      receivedQty,
      warehouseCode = "ODIONGAN_WAREHOUSE",
      remarks = null,
    } = req.data || {};

    const normalizedShipmentId = normalizeString(shipmentId);
    if (!normalizedShipmentId) {
      throw new HttpsError("invalid-argument", "shipmentId is required.");
    }

    const parsedReceived = parseNonNegativeInt(receivedQty, "receivedQty");
    if (parsedReceived == null) {
      throw new HttpsError("invalid-argument", "receivedQty is required.");
    }

    const shipmentRef = db.collection("shipments").doc(normalizedShipmentId);
    const shipmentSnap = await shipmentRef.get();

    if (!shipmentSnap.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipmentData = shipmentSnap.data() || {};
    if (
      actor.role === "manager" &&
      !canAccessRecord(actor.user, shipmentData)
    ) {
      throw new HttpsError(
        "permission-denied",
        "This shipment is outside your assigned warehouse or municipality.",
      );
    }
    assertEligibleForHubReconcile(shipmentRef.id, shipmentData.status);

    const defaultExpected = getExpectedPieceCount(shipmentData);
    const parsedExpected =
      parseNonNegativeInt(expectedQty, "expectedQty") ?? defaultExpected;

    if (parsedExpected <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot reconcile: shipment has no expected pieces.",
      );
    }

    const variance = parsedReceived - parsedExpected;
    const reconcileResult = `${parsedReceived} of ${parsedExpected} pieces matched`;
    const normalizedWarehouse =
      normalizeString(warehouseCode) || "ODIONGAN_WAREHOUSE";
    const now = FieldValue.serverTimestamp();
    const note =
      normalizeString(remarks) ||
      (variance === 0
        ? reconcileResult
        : `${reconcileResult} (variance: ${variance > 0 ? "+" : ""}${variance})`);

    await db.runTransaction(async (tx) => {
      tx.update(shipmentRef, {
        reconcileExpectedQty: parsedExpected,
        reconcileReceivedQty: parsedReceived,
        reconcileVariance: variance,
        reconcileResult,
        reconcileExpected: parsedExpected,
        reconcileReceived: parsedReceived,
        reconciledAt: now,
        reconciledBy: actorName || actorUid || null,
        reconciledByUid: actorUid || null,
        reconcileWarehouseCode: normalizedWarehouse,
        hubReceivedByName:
          shipmentData.hubReceivedByName || actorName || null,
        updatedAt: now,
        updatedBy: actorName || actorUid || null,
        statusHistory: FieldValue.arrayUnion({
          status: "RECONCILED",
          at: admin.firestore.Timestamp.now(),
          by: actorName || actorUid || null,
          note,
          location: normalizedWarehouse,
        }),
      });
    });

    await writeShipmentEvent({
      db,
      event: {
        shipmentId: normalizedShipmentId,
        eventType: EVENT_TYPES.RECONCILED,
        tripId: shipmentData.currentTripId || shipmentData.currentTruckTripId || null,
        warehouseManagerId: actorUid || null,
        warehouseManagerName: actorName || null,
        location: normalizedWarehouse,
        remarks: note,
        createdBy: actorName || actorUid || null,
        createdByRole: actorRole || null,
        source: "reconcile_shipment_at_hub",
      },
    });

    return {
      success: true,
      shipmentId: normalizedShipmentId,
      expectedQty: parsedExpected,
      receivedQty: parsedReceived,
      variance,
      reconcileResult,
      hasVariance: variance !== 0,
    };
  },
);
