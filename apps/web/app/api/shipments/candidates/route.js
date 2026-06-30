import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic"; // Prevent caching of candidate lookups

function serializeShipmentDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    // Convert Timestamps to Strings for JSON safety
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
    // Exact tracking-ID lookup so Admins can add a specific missing shipment/piece
    // (e.g. AT-20260612-SHP-677769) even when it is outside the default candidate
    // pool (not RECEIVED, already linked to another trip, or a different origin).
    const shipmentId = searchParams.get("shipmentId");
    const limitSize = 50;

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
      .where("currentTripId", "==", null) // Unassigned
      .where("status", "==", "RECEIVED") // In Warehouse
      .orderBy("createdAt", "desc")
      .limit(limitSize);

    // PAGINATION LOGIC
    if (cursor) {
      // Create a Date object from the cursor string
      const startAfterDate = new Date(cursor);
      q = q.startAfter(startAfterDate);
    }

    const snapshot = await q.get();

    const shipments = snapshot.docs.map(serializeShipmentDoc);

    // Prepare next cursor
    const lastItem = shipments[shipments.length - 1];
    const nextCursor = lastItem ? lastItem.createdAt : null;

    return NextResponse.json({
      success: true,
      data: shipments,
      nextCursor: nextCursor,
      hasMore: shipments.length === limitSize,
    });
  } catch (error) {
    console.error("Candidates API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
