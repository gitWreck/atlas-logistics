import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic"; // Prevent caching of candidate lookups

// Master statuses that may still have warehouse pieces available to load.
// RECEIVED = nothing loaded yet; PARTIALLY_LOADED = split across trip(s) with a
// remainder still at the warehouse (single-trip splits keep currentTripId set,
// multi-trip splits null it — so we can't rely on the trip pointer here).
const LOADABLE_SHIPMENT_STATUSES = ["RECEIVED", "PARTIALLY_LOADED"];

// Piece statuses that are still sitting at a warehouse and can be linehaul-loaded.
const LOAD_ELIGIBLE_PIECE_STATUSES = new Set([
  "RECEIVED_AT_DIVISORIA",
  "RECEIVED",
  "ARRIVED_AT_ODIONGAN",
]);

function packageQty(pkg) {
  return Math.max(Number(pkg?.quantity) || 1, 1);
}

// Mirrors packageEligibleForLinehaulLoad (apps/functions tripPackageOperations).
function pieceLoadEligible(pkg) {
  if (!pkg) return false;
  if (String(pkg.loadedOnTrip || "").trim()) return false;

  const loadedQty = Math.min(Number(pkg.loadedQty) || 0, packageQty(pkg));
  if (loadedQty > 0 && String(pkg.currentTripId || "").trim()) return false;

  const status = String(pkg.status || "").toUpperCase();
  return LOAD_ELIGIBLE_PIECE_STATUSES.has(status);
}

function shipmentHasLoadEligiblePieces(data) {
  const packages = Array.isArray(data?.packages) ? data.packages : [];
  return packages.some(pieceLoadEligible);
}

function serializeShipmentDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString(),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const cursor = searchParams.get("cursor"); // The 'createdAt' of the last item
    const shipmentId = searchParams.get("shipmentId");
    const limitSize = 50;

    // Exact tracking-id lookup so Admins can add a specific missing shipment/piece
    // even when it is outside the default candidate pool.
    if (shipmentId) {
      const trimmed = shipmentId.trim();
      if (!trimmed) {
        return NextResponse.json({
          success: true,
          data: [],
          nextCursor: null,
          hasMore: false,
          exactLookup: true,
        });
      }

      const snap = await adminDb.collection("shipments").doc(trimmed).get();
      if (!snap.exists) {
        return NextResponse.json({
          success: true,
          data: [],
          nextCursor: null,
          hasMore: false,
          exactLookup: true,
        });
      }

      return NextResponse.json({
        success: true,
        data: [serializeShipmentDoc(snap)],
        nextCursor: null,
        hasMore: false,
        exactLookup: true,
      });
    }

    if (!origin) {
      return NextResponse.json(
        { error: "Missing Origin Code" },
        { status: 400 },
      );
    }

    let q = adminDb
      .collection("shipments")
      .where("originCode", "==", origin)
      .where("status", "in", LOADABLE_SHIPMENT_STATUSES)
      .orderBy("createdAt", "desc")
      .limit(limitSize);

    // PAGINATION LOGIC
    if (cursor) {
      const startAfterDate = new Date(cursor);
      q = q.startAfter(startAfterDate);
    }

    const snapshot = await q.get();

    // Keep pagination anchored to the RAW query (last fetched doc), so the
    // cursor stays correct even when we drop shipments with no loadable pieces.
    const lastRawDoc = snapshot.docs[snapshot.docs.length - 1];
    const lastRawCreatedAt = lastRawDoc?.data()?.createdAt;
    const nextCursor = lastRawCreatedAt?.toDate
      ? lastRawCreatedAt.toDate().toISOString()
      : null;

    const shipments = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(shipmentHasLoadEligiblePieces)
      .map((data) => ({
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
      }));

    return NextResponse.json({
      success: true,
      data: shipments,
      nextCursor,
      // hasMore reflects the raw query so "load more" keeps working even if the
      // current page filtered down to fewer (or zero) eligible shipments.
      hasMore: snapshot.docs.length === limitSize,
    });
  } catch (error) {
    console.error("Candidates API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
