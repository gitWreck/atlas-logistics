import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";
import { canDeleteShipmentsAndTrips } from "@/app/utility/deletePermissions";

export const dynamic = "force-dynamic";

function serializeFirestoreValue(value) {
  if (!value) return value;

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serializeFirestoreValue(val);
    }
    return out;
  }

  return value;
}

function normalizeLogEntry(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    action: data.action || data.actionType || null,
    user: data.user || data.actorName || null,
    actorId: data.actorId || data.actorUid || null,
    actorRole: data.actorRole || null,
    reason: data.reason || null,
    previousValue: serializeFirestoreValue(
      data.previousValue ?? data.details?.before ?? null,
    ),
    newValue: serializeFirestoreValue(
      data.newValue ?? data.details?.after ?? null,
    ),
    note: data.note || null,
    timestamp: serializeFirestoreValue(
      data.timestamp || data.createdAt || null,
    ),
    targetCollection: data.targetCollection || null,
    targetId: data.targetId || null,
    source: "audit_logs",
  };
}

export async function GET(_req, context) {
  try {
    const { tripId: tripDocId } = await context.params;

    if (!tripDocId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const userDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const userData = userDoc.data() || {};

    if (
      !userDoc.exists ||
      !canDeleteShipmentsAndTrips(
        { role: userData.role, email: userData.email },
        { email: decodedToken.email },
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Admin or warehouse manager access required" },
        { status: 403 },
      );
    }

    const tripRef = adminDb.collection("truck_trips").doc(tripDocId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripSnap.data() || {};
    const publicTripId = trip.tripId || tripDocId;

    const [byDocIdSnap, byTripIdSnap, manifestEventsSnap] = await Promise.all([
      adminDb
        .collection("audit_logs")
        .where("targetId", "==", tripDocId)
        .limit(100)
        .get()
        .catch(() => ({ docs: [] })),
      adminDb
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
        user:
          data.unlockedBy ||
          data.cancelledBy ||
          data.archivedBy ||
          data.createdBy ||
          null,
        actorId: null,
        actorRole: null,
        reason: data.reason || null,
        previousValue: null,
        newValue: serializeFirestoreValue(data),
        note: data.type || null,
        timestamp: serializeFirestoreValue(data.createdAt || null),
        targetCollection: "truck_trips",
        targetId: tripDocId,
        source: "manifest_events",
      });
    });

    const entries = Array.from(merged.values()).sort((a, b) => {
      const aMs = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bMs = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bMs - aMs;
    });

    return NextResponse.json({
      success: true,
      tripId: tripDocId,
      tripCode: publicTripId,
      entries,
    });
  } catch (error) {
    console.error("Trip audit log error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load audit log" },
      { status: 500 },
    );
  }
}
