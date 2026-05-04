import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

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

    if (!manifestId) {
      return NextResponse.json(
        { error: "Trip has no manifest to reconcile" },
        { status: 400 },
      );
    }

    const manifestSnap = await adminDb
      .collection("manifests")
      .doc(manifestId)
      .get();

    if (!manifestSnap.exists) {
      return NextResponse.json(
        { error: "Manifest not found" },
        { status: 404 },
      );
    }

    const manifest = manifestSnap.data() || {};
    const manifestShipments = Array.isArray(manifest.shipments)
      ? manifest.shipments
      : [];

    const rows = await Promise.all(
      manifestShipments.map(async (item) => {
        const shipmentDocId =
          item.trackingShipmentId || item.shipmentId || item.id || null;

        if (!shipmentDocId) return null;

        const [tripShipmentSnap, shipmentSnap] = await Promise.all([
          tripRef.collection("trip_shipments").doc(shipmentDocId).get(),
          adminDb.collection("shipments").doc(shipmentDocId).get(),
        ]);

        const tripShipment = tripShipmentSnap.data() || {};
        const shipment = shipmentSnap.data() || {};
        const expectedCount = toNumber(
          item.loadedCount ?? item.totalCount ?? tripShipment.totalItems,
          0,
        );
        const remainingLoaded = toNumber(tripShipment.loadedCount, 0);
        const unloadedCount = Math.max(expectedCount - remainingLoaded, 0);
        const isMissing = remainingLoaded > 0 || !tripShipmentSnap.exists;

        return {
          id: shipmentDocId,
          shipmentId: shipment.shipmentId || item.shipmentId || shipmentDocId,
          recipientName:
            shipment.recipient?.name || item.receiverName || "Unknown recipient",
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
      }),
    );

    const shipments = rows.filter(Boolean);
    const missingShipments = shipments.filter((item) => item.missing);
    const unloadedShipments = shipments.filter((item) => !item.missing);

    return NextResponse.json({
      tripId,
      manifestId,
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
