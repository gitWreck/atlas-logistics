import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

async function buildReconciliationRow(tripRef, tripId, item, shipmentDocId) {
  if (!shipmentDocId) return null;

  const [tripShipmentSnap, shipmentSnap] = await Promise.all([
    tripRef.collection("trip_shipments").doc(shipmentDocId).get(),
    adminDb.collection("shipments").doc(shipmentDocId).get(),
  ]);

  const tripShipment = tripShipmentSnap.data() || {};
  const shipment = shipmentSnap.data() || {};
  const expectedCount = toNumber(
    item?.loadedCount ??
      item?.totalCount ??
      tripShipment.totalItems ??
      shipment.totals?.totalContentQty,
    0,
  );
  const remainingLoaded = toNumber(tripShipment.loadedCount, 0);
  const unloadedCount = Math.max(expectedCount - remainingLoaded, 0);
  const isMissing = remainingLoaded > 0 || !tripShipmentSnap.exists;

  return {
    id: shipmentDocId,
    shipmentId: shipment.shipmentId || item?.shipmentId || shipmentDocId,
    recipientName:
      shipment.recipient?.name || item?.receiverName || "Unknown recipient",
    destination:
      shipment.recipient?.city ||
      shipment.destination ||
      shipment.destinationCode ||
      "Unknown destination",
    expectedCount,
    unloadedCount,
    remainingLoaded,
    missing: isMissing,
    currentTripId: shipment.currentTripId || tripId,
    status: shipment.status || tripShipment.status || null,
  };
}

async function reconcileFromLockedManifest(tripRef, tripId, manifestId) {
  const manifestSnap = await adminDb.collection("manifests").doc(manifestId).get();

  if (!manifestSnap.exists) {
    return {
      error: "Manifest not found",
      status: 404,
    };
  }

  const manifest = manifestSnap.data() || {};
  const manifestShipments = Array.isArray(manifest.shipments)
    ? manifest.shipments
    : [];

  const rows = await Promise.all(
    manifestShipments.map((item) => {
      const shipmentDocId =
        item.trackingShipmentId || item.shipmentId || item.id || null;
      return buildReconciliationRow(tripRef, tripId, item, shipmentDocId);
    }),
  );

  return {
    manifestId,
    source: "locked_manifest",
    shipments: rows.filter(Boolean),
  };
}

async function reconcileFromTripShipments(tripRef, tripId) {
  const tripShipmentSnap = await tripRef.collection("trip_shipments").get();

  if (tripShipmentSnap.empty) {
    return {
      error:
        "Trip has no shipments to reconcile. Add shipments to the trip manifest first.",
      status: 400,
    };
  }

  const rows = await Promise.all(
    tripShipmentSnap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const shipmentDocId =
        data.trackingShipmentId || docSnap.id || data.shipmentId || null;
      return buildReconciliationRow(tripRef, tripId, data, shipmentDocId);
    }),
  );

  return {
    manifestId: null,
    source: "trip_shipments",
    shipments: rows.filter(Boolean),
  };
}

export async function GET(_request, { params }) {
  try {
    const { tripId } = await params;
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const role = userSnap.data()?.role?.toLowerCase();

    if (!["admin", "manager"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!tripId) {
      return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
    }

    const tripRef = adminDb.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripSnap.data() || {};
    const manifestId = trip.manifestId;

    let result = manifestId
      ? await reconcileFromLockedManifest(tripRef, tripId, manifestId)
      : await reconcileFromTripShipments(tripRef, tripId);

    if (result.error && manifestId) {
      const fallback = await reconcileFromTripShipments(tripRef, tripId);
      if (!fallback.error) {
        result = fallback;
      }
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    const shipments = result.shipments || [];
    const missingShipments = shipments.filter((item) => item.missing);
    const unloadedShipments = shipments.filter((item) => !item.missing);

    return NextResponse.json({
      tripId,
      manifestId: result.manifestId,
      source: result.source,
      ready: missingShipments.length === 0,
      totals: {
        manifestShipments: shipments.length,
        unloadedShipments: unloadedShipments.length,
        missingShipments: missingShipments.length,
      },
      shipments,
      unloadedShipments,
      missingShipments,
    });
  } catch (error) {
    console.error("Handoff reconciliation API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reconcile manifest" },
      { status: 500 },
    );
  }
}
