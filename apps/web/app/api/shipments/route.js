import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. AUTHENTICATION
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 2. CHECK ROLE
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (
      !userData ||
      !["admin", "manager", "driver", "checker"].includes(
        userData.role?.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Staff Access Only" },
        { status: 403 },
      );
    }

    // 3. FETCH SHIPMENTS (The Base Data)
    const snapshot = await adminDb
      .collection("shipments")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    // ---------------------------------------------------------
    // 4. NEW LOGIC: PRE-FETCH TRUCK DATA
    // ---------------------------------------------------------

    // A. Extract all Unique Trip IDs from the shipments
    const uniqueTripIds = new Set();
    snapshot.docs.forEach((doc) => {
      const tripId = doc.data().currentTruckTripId;
      if (tripId && typeof tripId === "string") {
        uniqueTripIds.add(tripId);
      }
    });

    // B. Fetch all related Trips in ONE batch request (Efficient)
    let tripMap = {}; // Will store { "TRIP-DOC-ID": { ...tripData } }

    if (uniqueTripIds.size > 0) {
      const tripRefs = Array.from(uniqueTripIds).map((id) =>
        adminDb.collection("truck_trips").doc(id),
      );

      // getAll() is much faster than looping with await
      const tripSnapshots = await adminDb.getAll(...tripRefs);

      tripSnapshots.forEach((snap) => {
        if (snap.exists) {
          const tripData = snap.data();

          // ✅ UPDATE: Only add to map if the trip is active
          if (tripData.active === true) {
            tripMap[snap.id] = tripData;
          }
        }
      });
    }

    // ---------------------------------------------------------
    // 5. TRANSFORM & MERGE DATA
    // ---------------------------------------------------------
    const shipments = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Find the truck info from our pre-fetched map
      const assignedTrip = data.currentTruckTripId
        ? tripMap[data.currentTruckTripId]
        : null;

      // Safe math for progress
      const total = data.totals?.totalItems || 1;
      const delivered = data.totals?.delivered || 0;
      const percent = Math.round((delivered / total) * 100);

      // Handle Dates
      const createdAt = data.createdAt
        ? formatFirestoreDate(data.createdAt)
        : null;
      const updatedAt = data.updatedAt
        ? formatFirestoreDate(data.updatedAt)
        : null;

      return {
        id: doc.id,
        ...data,
        createdAt: createdAt,
        updatedAt: updatedAt,

        // --- NEW: ENRICHED TRUCK DATA ---
        // This makes it easy to show "Driver: Juan" or "Status: DELAYED" on the board
        truckDetails: assignedTrip
          ? {
              tripId: assignedTrip.tripId, // Human ID (e.g. TRIP-2023...)
              driverName: assignedTrip.driverName || "Unassigned",
              truckPlate: assignedTrip.truckPlateNumber || "N/A",
              status: assignedTrip.status,
              delayCleared: assignedTrip.delayCleared, // Boolean flag
              delayReason: assignedTrip.delayReason || null,
            }
          : null,

        // Calculated Fields
        // route:
        //   data.origin && data.destination
        //     ? `${data.origin.substring(0, 3)} → ${data.destination.substring(
        //         0,
        //         3
        //       )}`
        //     : "—",
        // progressPercent: percent,
      };
    });

    return NextResponse.json({ shipments });
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments", details: error.message },
      { status: 500 },
    );
  }
}
