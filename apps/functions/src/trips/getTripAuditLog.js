"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireTripLifecycleAdmin } = require("./tripLifecycleAdmin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normalizeLogEntry(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    action: data.action || data.actionType || null,
    user: data.user || data.actorName || null,
    actorId: data.actorId || data.actorUid || null,
    actorRole: data.actorRole || null,
    reason: data.reason || null,
    previousValue: data.previousValue ?? data.details?.before ?? null,
    newValue: data.newValue ?? data.details?.after ?? null,
    note: data.note || null,
    timestamp: data.timestamp || data.createdAt || null,
    targetCollection: data.targetCollection || null,
    targetId: data.targetId || null,
    source: "audit_logs",
  };
}

exports.getTripAuditLog = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireTripLifecycleAdmin(db, req);

    const tripDocId = String(req.data?.tripDocId || req.data?.tripId || "").trim();
    if (!tripDocId) {
      throw new HttpsError("invalid-argument", "tripId is required");
    }

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found");
    }

    const trip = tripSnap.data() || {};
    const publicTripId = trip.tripId || tripDocId;

    const [byDocIdSnap, byTripIdSnap, manifestEventsSnap] = await Promise.all([
      db
        .collection("audit_logs")
        .where("targetId", "==", tripDocId)
        .limit(100)
        .get()
        .catch(() => ({ docs: [] })),
      db
        .collection("audit_logs")
        .where("tripId", "==", publicTripId)
        .limit(100)
        .get()
        .catch(() => ({ docs: [] })),
      tripRef
        .collection("manifest_events")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get()
        .catch(() => ({ docs: [] })),
    ]);

    const merged = new Map();

    [...byDocIdSnap.docs, ...byTripIdSnap.docs].forEach((doc) => {
      merged.set(doc.id, normalizeLogEntry(doc));
    });

    manifestEventsSnap.docs.forEach((doc) => {
      const data = doc.data() || {};
      merged.set(`manifest_event_${doc.id}`, {
        id: doc.id,
        action: data.type || "MANIFEST_EVENT",
        user: data.unlockedBy || data.cancelledBy || data.archivedBy || data.createdBy || null,
        actorId: null,
        actorRole: null,
        reason: data.reason || null,
        previousValue: null,
        newValue: data,
        note: data.type || null,
        timestamp: data.createdAt || null,
        targetCollection: "truck_trips",
        targetId: tripDocId,
        source: "manifest_events",
      });
    });

    const entries = Array.from(merged.values()).sort((a, b) => {
      const aMs = a.timestamp?.toMillis?.() || 0;
      const bMs = b.timestamp?.toMillis?.() || 0;
      return bMs - aMs;
    });

    return {
      success: true,
      tripId: tripDocId,
      tripCode: publicTripId,
      entries,
    };
  },
);
