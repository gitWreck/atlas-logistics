import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const cursor = searchParams.get("cursor"); // The 'createdAt' of the last item
    const limitSize = 50;

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

    const shipments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Timestamps to Strings for JSON safety
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
      };
    });

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
