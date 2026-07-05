"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireString } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const { normalizeQty } = require("../utilities/packageHelpers");
const {
  packageOnTrip,
  buildShipmentSnapshot,
  normalizePackageRow,
} = require("../packages/tripPackageOperations");
const {
  requireTripLifecycleAdmin,
  snapshotTripLifecycleState,
  assertTripNotArchived,
  updatedBy,
} = require("./tripLifecycleAdmin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function deriveResetPackageStatus(pkg = {}) {
  const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
  const damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);

  if (damagedQty > 0) return "DAMAGED";
  if (missingQty > 0) return "MISSING";
  return "RECEIVED";
}

function resetPackagesDetachedFromTrip(packages = [], tripId, actorName) {
  return packages.map((pkg) => {
    if (!packageOnTrip(pkg, tripId)) {
      return pkg;
    }

    const normalized = normalizePackageRow(pkg);
    const quantity = Math.max(normalizeQty(normalized.quantity, 1), 1);
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const missingQty = clamp(normalizeQty(normalized.missingQty, 0), 0, quantity);
    const damagedQty = clamp(normalizeQty(normalized.damagedQty, 0), 0, quantity);
    const resetPkg = {
      ...normalized,
      quantity,
      loadedQty: 0,
      receivedQty: 0,
      missingQty,
      damagedQty,
      currentTripId: null,
      loadedOnTrip: null,
      loadedAt: null,
      loadedBy: null,
      loadedByRole: null,
      loadedByUid: null,
      loadedAtLocation: null,
      deliveredAt: null,
      deliveredBy: null,
      updatedAt: new Date().toISOString(),
      updatedBy: actorName || "SYSTEM",
    };

    return {
      ...resetPkg,
      status: deriveResetPackageStatus(resetPkg),
    };
  });
}

async function detachShipmentsFromTrip(tripDocId, actorName) {
  const shipmentIds = new Set();
  const tripRef = db.collection("truck_trips").doc(tripDocId);
  const tripSnap = await tripRef.get();
  const tripData = tripSnap.exists ? tripSnap.data() || {} : {};

  const tripShipSnap = await tripRef.collection("trip_shipments").get();

  tripShipSnap.docs.forEach((doc) => shipmentIds.add(doc.id));

  // Multi-trip shipments have currentTripId=null, so also match the
  // currentTripIds array to detach the cancelled trip from split shipments.
  const [byTripIdSnap, byTruckTripIdSnap, byTripIdsArraySnap] =
    await Promise.all([
      db.collection("shipments").where("currentTripId", "==", tripDocId).get(),
      db
        .collection("shipments")
        .where("currentTruckTripId", "==", tripDocId)
        .get(),
      db
        .collection("shipments")
        .where("currentTripIds", "array-contains", tripDocId)
        .get()
        .catch(() => ({ docs: [] })),
    ]);

  byTripIdSnap.docs.forEach((doc) => shipmentIds.add(doc.id));
  byTruckTripIdSnap.docs.forEach((doc) => shipmentIds.add(doc.id));
  byTripIdsArraySnap.docs.forEach((doc) => shipmentIds.add(doc.id));

  const now = FieldValue.serverTimestamp();
  const ids = Array.from(shipmentIds);

  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const refs = chunk.map((id) => db.collection("shipments").doc(id));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    const batch = db.batch();

    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      const updatedPackages = resetPackagesDetachedFromTrip(
        data.packages || [],
        tripDocId,
        actorName,
      );
      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: data.status,
      });
      const fullyDetached = (snapshot.currentTripIds || []).length === 0;

      const update = {
        packages: snapshot.packages,
        status: snapshot.status,
        packageBreakdown: snapshot.packageBreakdown,
        availableForDelivery: snapshot.packageBreakdown?.available > 0,
        currentTripIds: snapshot.currentTripIds,
        currentTripId: snapshot.currentTripId,
        "totals.pending": snapshot.totals.pending,
        "totals.loaded": snapshot.totals.loaded,
        "totals.delivered": snapshot.totals.delivered,
        "totals.received": snapshot.totals.received,
        "totals.missing": snapshot.totals.missing,
        "totals.damaged": snapshot.totals.damaged,
        "totals.totalContentQty": snapshot.totals.totalContentQty,
        "totals.totalItems": snapshot.totals.totalItems,
        updatedAt: now,
        updatedBy: actorName || "SYSTEM",
      };

      // Only clear the truck-trip pointer / assignment stamp when nothing
      // remains; otherwise preserve them for the surviving trip.
      if (String(data.currentTruckTripId || "") === tripDocId) {
        update.currentTruckTripId = null;
      }
      if (fullyDetached) {
        update.assignedToTripAt = null;
      }

      batch.update(snap.ref, update);
    });

    await batch.commit();
  }

  for (let i = 0; i < tripShipSnap.docs.length; i += 400) {
    const chunk = tripShipSnap.docs.slice(i, i + 400);
    const batch = db.batch();

    chunk.forEach((doc) => {
      const manifest = doc.data() || {};
      const totalItems = normalizeQty(manifest.totalItems, 0);
      batch.update(doc.ref, {
        status: "CANCELLED",
        loadedCount: 0,
        pendingCount: totalItems,
        deliveredCount: 0,
        receivedCount: 0,
        updatedAt: now,
        updatedBy: actorName || "SYSTEM",
      });
    });

    await batch.commit();
  }

  await tripRef.update({
    totalLoaded: 0,
    itemPending: normalizeQty(tripData.totalItems, 0),
    updatedAt: now,
    updatedBy: actorName || "SYSTEM",
  });

  return { detachedShipmentCount: ids.length };
}

exports.cancelTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireTripLifecycleAdmin(db, req);

    const { uid, role, name } = updatedBy(req);
    const tripDocId = requireString(
      req.data?.tripDocId || req.data?.tripId,
      "tripId",
    );
    const reason = requireString(req.data?.reason, "reason");

    const tripRef = db.collection("truck_trips").doc(tripDocId);

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) {
        throw new HttpsError("not-found", "Trip not found");
      }

      const trip = tripSnap.data() || {};
      assertTripNotArchived(trip);

      const status = String(trip.status || "").toUpperCase();
      if (status === "CANCELLED") {
        throw new HttpsError("failed-precondition", "Trip is already cancelled.");
      }
      if (status === "COMPLETED" || status === "DELIVERED") {
        throw new HttpsError(
          "failed-precondition",
          "Completed trips cannot be cancelled. Archive the trip instead.",
        );
      }

      const before = snapshotTripLifecycleState(trip);
      const after = {
        ...before,
        status: "CANCELLED",
        active: false,
      };

      tx.update(tripRef, {
        status: "CANCELLED",
        active: false,
        totalLoaded: 0,
        cancellationReason: reason,
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: uid,
        cancelledByName: name || null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name || uid,
      });

      writeCustodyAuditLog({
        db,
        tx,
        action: "CANCEL_TRIP",
        targetCollection: "truck_trips",
        targetId: tripDocId,
        tripDocId,
        tripId: trip.tripId || tripDocId,
        actorId: uid,
        actorName: name,
        actorRole: role,
        reason,
        previousValue: before,
        newValue: after,
        note: "Trip cancelled (soft). Shipments and audit history are preserved.",
      });

      const eventRef = tripRef.collection("manifest_events").doc();
      tx.set(eventRef, {
        type: "TRIP_CANCELLED",
        reason,
        cancelledBy: name || uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    const detachStats = await detachShipmentsFromTrip(tripDocId, name);

    const tripSnap = await tripRef.get();
    const trip = tripSnap.data() || {};
    if (trip.truckId) {
      const truckRef = db.collection("trucks").doc(trip.truckId);
      const truckSnap = await truckRef.get();
      if (truckSnap.exists && truckSnap.data()?.currentTripId === tripDocId) {
        await truckRef.update({
          currentTripId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return { success: true, tripId: tripDocId, ...detachStats };
  },
);
