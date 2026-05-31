"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");
const {
  formatLedgerEvent,
  formatStatusHistoryEvent,
  dedupeTimelineEvents,
  sortTimelineEvents,
} = require("./custodyTimelineFormat");
const {
  enrichTimelineWithTripContext,
} = require("./enrichTimelineWithTripContext");
const {
  buildScanInfoTransportSummary,
} = require("./scanInfoTransportSummary");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

exports.getShipmentCustodyTimeline = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker", "driver"]);

    const { shipmentId, pieceId = null } = req.data || {};
    const normalizedShipmentId = normalizeString(shipmentId);

    if (!normalizedShipmentId) {
      throw new HttpsError("invalid-argument", "shipmentId is required.");
    }

    const normalizedPieceId = normalizeString(pieceId);
    const shipmentRef = db.collection("shipments").doc(normalizedShipmentId);
    const shipmentSnap = await shipmentRef.get();

    if (!shipmentSnap.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipmentData = shipmentSnap.data() || {};
    const eventsSnap = await db
      .collection("shipment_events")
      .where("shipmentId", "==", normalizedShipmentId)
      .get();

    let ledgerEvents = eventsSnap.docs.map((docSnap) =>
      formatLedgerEvent(docSnap),
    );

    if (normalizedPieceId) {
      ledgerEvents = ledgerEvents.filter(
        (event) =>
          !event.pieceId || String(event.pieceId) === normalizedPieceId,
      );
    }

    const historyEvents = (
      Array.isArray(shipmentData.statusHistory)
        ? shipmentData.statusHistory
        : []
    ).map((entry, index) =>
      formatStatusHistoryEvent(normalizedShipmentId, entry, index),
    );

    const events = sortTimelineEvents(
      dedupeTimelineEvents([...ledgerEvents, ...historyEvents]),
    );
    const enrichedEvents = await enrichTimelineWithTripContext(
      db,
      events,
      shipmentData,
    );
    const transport = await buildScanInfoTransportSummary(
      db,
      shipmentData,
      enrichedEvents,
    );

    return {
      success: true,
      shipmentId: normalizedShipmentId,
      pieceId: normalizedPieceId,
      shipmentStatus: shipmentData.status || null,
      total: enrichedEvents.length,
      events: enrichedEvents,
      transport,
    };
  },
);
