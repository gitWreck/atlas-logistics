import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { tripId } = await params;

    if (!tripId) {
      return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
    }

    // --- AUTH CHECKS (Same as before) ---
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (
      !userDoc.exists ||
      !["admin", "manager"].includes(userDoc.data().role?.toLowerCase())
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // ------------------------------------

    // 1. Fetch the Sub-Collection
    const snapshot = await adminDb
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .orderBy("createdAt", "desc")
      .get();

    // 2. Initialize Counters
    let totalLoaded = 0;
    let totalPending = 0;
    let totalItems = 0;

    // 3. Transform Data & Aggregate
    const shipments = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Safety check: ensure numbers are valid
      const sLoaded = Number(data.loadedCount) || 0;
      const sPending = Number(data.pendingCount) || 0;
      const sTotal = Number(data.totalItems) || 0;

      // Add to running totals
      totalLoaded += sLoaded;
      totalPending += sPending;
      totalItems += sTotal;

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
      };
    });

    // 4. Return shipments AND the calculated totals
    return NextResponse.json({
      shipments,
      stats: {
        totalLoaded,
        totalPending,
        totalItems,
      },
    });
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 },
    );
  }
}
