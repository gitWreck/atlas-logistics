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
      .where("isPickupRequested", "==", true) // ✅ ONLY fetch pickup requests
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
      if (tripId) uniqueTripIds.add(tripId);
    });

    // B. Fetch all related Trips in ONE batch request (Efficient)
    let tripMap = {}; // Will store { "TRIP-DOC-ID": { ...tripData } }
    if (uniqueTripIds.size > 0) {
      const tripRefs = Array.from(uniqueTripIds).map((id) =>
        adminDb.collection("truck_trips").doc(id),
      );

      const tripSnapshots = await adminDb.getAll(...tripRefs);
      tripSnapshots.forEach((snap) => {
        if (snap.exists) {
          tripMap[snap.id] = snap.data();
          // Note: Removed the hard 'active === true' filter here so
          // that the dashboard still shows the trip info even if
          // it was recently completed or in a different state.
        }
      });
    }

    // ---------------------------------------------------------
    // 5. TRANSFORM & MERGE DATA
    // ---------------------------------------------------------
    const pickups = snapshot.docs.map((doc) => {
      const data = doc.data();
      const assignedTrip = data.currentTruckTripId
        ? tripMap[data.currentTruckTripId]
        : null;

      // ✅ ADJUSTED MATH: Progress based on Bundled Quantity
      // Use totalContentQty if it exists (Bundled Mode), fallback to totalItems
      const totalUnits =
        data.totals?.totalContentQty || data.totals?.totalItems || 1;
      const deliveredUnits = data.totals?.delivered || 0;
      const loadedUnits = data.totals?.loaded || 0;

      const progressPercent = Math.round((deliveredUnits / totalUnits) * 100);
      const loadPercent = Math.round(
        (loadedUnits / (data.totals?.totalItems || 1)) * 100,
      );

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
        createdAt,
        updatedAt,

        // Calculated Metrics for Dashboard
        metrics: {
          totalContent: totalUnits,
          totalPackages: data.totals?.totalItems || 0,
          totalDelivered: deliveredUnits,
          totalLoaded: loadedUnits,
          progressPercent,
          loadPercent, // Shows how many Sacks/Bundles are actually on the truck
        },

        truckDetails: assignedTrip
          ? {
              tripId: assignedTrip.tripId,
              driverName: assignedTrip.driverName || "Unassigned",
              truckPlate: assignedTrip.truckPlateNumber || "N/A",
              status: assignedTrip.status,
              delayCleared: assignedTrip.delayCleared,
              delayReason: assignedTrip.delayReason || null,
            }
          : null,
      };
    });

    // return NextResponse.json({ shipments });
    // ✅ Return 'pickups' instead of 'shipments'
    return NextResponse.json({ pickups });
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments", details: error.message },
      { status: 500 },
    );
  }
}
