import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";
import { resolveShipmentDeliveryMetrics } from "@/app/utility/shipmentProgress";
import { toShipmentIsoDate } from "@/app/utility/shipmentBoardFormatter";

export const dynamic = "force-dynamic";

const PICKUP_PHASE_STATUSES = new Set(["PENDING_PICKUP", "PICKED_UP"]);

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit") || "50";
    const allowedLimits = ["all", "50", "100", "200"];

    if (!allowedLimits.includes(limitParam)) {
      return NextResponse.json(
        { error: "Invalid limit. Use all, 50, 100, or 200." },
        { status: 400 },
      );
    }

    // 3. FETCH SHIPMENTS (The Base Data)
    let pickupsQuery = adminDb
      .collection("shipments")
      .where("isPickupRequested", "==", true) // ✅ ONLY fetch pickup requests
      .orderBy("updatedAt", "desc");

    if (limitParam !== "all") {
      pickupsQuery = pickupsQuery.limit(Number(limitParam) * 5);
    }

    const snapshot = await pickupsQuery.get();

    // ---------------------------------------------------------
    // 4. NEW LOGIC: PRE-FETCH TRUCK DATA
    // ---------------------------------------------------------

    // A. Extract all Unique Trip IDs from the shipments
    const uniqueTripIds = new Set();
    snapshot.docs.forEach((doc) => {
      const tripId = doc.data().currentTripId;
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
    const pickupDocs = snapshot.docs.filter((doc) =>
      PICKUP_PHASE_STATUSES.has(String(doc.data().status || "").toUpperCase()),
    );

    const limitedPickupDocs =
      limitParam === "all"
        ? pickupDocs
        : pickupDocs.slice(0, Number(limitParam));

    const pickups = limitedPickupDocs.map((doc) => {
      const data = doc.data();
      const boardData = { ...data };
      if (limitParam === "all") {
        delete boardData.packages;
        delete boardData.packageBarcodes;
        delete boardData.statusHistory;
        delete boardData.proofOfDelivery;
        delete boardData.proofOfReceipt;
      }
      const assignedTrip = data.currentTripId
        ? tripMap[data.currentTripId]
        : null;

      // ✅ ADJUSTED MATH: Progress based on Bundled Quantity
      // Use totalContentQty if it exists (Bundled Mode), fallback to totalItems
      const totalUnits =
        data.totals?.totalContentQty || data.totals?.totalItems || 1;
      const loadedUnits = data.totals?.loaded || 0;
      const { total: deliveryTotal, delivered: deliveredUnits } =
        resolveShipmentDeliveryMetrics(data);
      const effectiveTotal = deliveryTotal > 0 ? deliveryTotal : totalUnits;

      const progressPercent =
        effectiveTotal > 0
          ? Math.round((deliveredUnits / effectiveTotal) * 100)
          : 0;
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
        ...boardData,
        createdAt,
        createdAtIso: toShipmentIsoDate(data.createdAt),
        updatedAt,
        updatedAtIso: toShipmentIsoDate(data.updatedAt),

        // Calculated Metrics for Dashboard
        metrics: {
          totalContent: effectiveTotal,
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
