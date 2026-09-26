import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  resolveShipmentDeliveryMetrics,
  calculateShipmentProgress,
} from "@/app/utility/shipmentProgress";
import { resolveShipmentPackageBreakdown } from "@/app/utility/packageStatus";
import { managerCanAccessRecord } from "@/lib/managerAccess";
import { toShipmentIsoDate } from "@/app/utility/shipmentBoardFormatter";

export const dynamic = "force-dynamic";

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
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const allowedLimits = ["all", "50", "100", "200"];

    if (!allowedLimits.includes(limitParam)) {
      return NextResponse.json(
        { error: "Invalid limit. Use all, 50, 100, or 200." },
        { status: 400 },
      );
    }

    const parseManilaDate = (value) => {
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
      return Date.parse(`${value}T00:00:00+08:00`);
    };
    const startMs = parseManilaDate(startDate);
    const endMs = parseManilaDate(endDate);
    if (
      Number.isNaN(startMs) ||
      Number.isNaN(endMs) ||
      (startMs !== null && endMs !== null && startMs > endMs)
    ) {
      return NextResponse.json({ error: "Invalid shipment date range." }, { status: 400 });
    }

    // 3. FETCH SHIPMENTS (The Base Data)
    // const snapshot = await adminDb
    //   .collection("shipments")
    //   // .where("status", "!=", "PENDING_PICKUP") // ✅ ONLY fetch pickup requests
    //   .where("isPickupRequested", "==", false) // ✅ ONLY fetch pickup requests
    //   .orderBy("updatedAt", "desc")
    //   .limit(50)
    //   .get();

    let shipmentsQuery = adminDb.collection("shipments");
    if (startMs !== null) {
      shipmentsQuery = shipmentsQuery.where("createdAt", ">=", new Date(startMs));
    }
    if (endMs !== null) {
      shipmentsQuery = shipmentsQuery.where(
        "createdAt",
        "<",
        new Date(endMs + 24 * 60 * 60 * 1000),
      );
    }
    shipmentsQuery = shipmentsQuery.orderBy(
      startMs !== null || endMs !== null ? "createdAt" : "updatedAt",
      "desc",
    );

    if (limitParam !== "all") {
      shipmentsQuery = shipmentsQuery.limit(Number(limitParam));
    }

    const snapshot = await shipmentsQuery.get();

    // THE 1-LINE FIX: Drop any document where it explicitly equals true.
    // This perfectly allows false, null, and missing fields to pass through.
    const standardDocs = snapshot.docs.filter((doc) => {
      const data = doc.data();
      return (
        data.isPickupRequested !== true &&
        managerCanAccessRecord(userData, data)
      );
    });

    // ---------------------------------------------------------
    // 4. PRE-FETCH TRUCK DATA
    // ---------------------------------------------------------

    // A. Extract all Unique Trip IDs from the FILTERED shipments
    const uniqueTripIds = new Set();
    standardDocs.forEach((doc) => {
      const tripId = doc.data().currentTripId;
      if (tripId) uniqueTripIds.add(tripId);
    });

    // ---------------------------------------------------------
    // 4. NEW LOGIC: PRE-FETCH TRUCK DATA
    // ---------------------------------------------------------

    // A. Extract all Unique Trip IDs from the shipments
    // const uniqueTripIds = new Set();
    // snapshot.docs.forEach((doc) => {
    //   const tripId = doc.data().currentTripId;
    //   if (tripId) uniqueTripIds.add(tripId);
    // });

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
    const shipments = standardDocs.map((doc) => {
      const data = doc.data();
      const boardData = { ...data };
      if (limitParam === "all") {
        // The board loads full shipment details from /api/shipments/[id] on open.
        // Keeping these large fields in an all-items response exceeds the
        // App Hosting response size limit for the current shipment collection.
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
      const breakdown = resolveShipmentPackageBreakdown(data);
      const checkerLoaded = Math.max(
        Number(breakdown.outForDelivery || 0),
        Number(breakdown.onCheckerVan || 0),
      );
      const { total: deliveryTotal, delivered: deliveredUnits } =
        resolveShipmentDeliveryMetrics(data);
      const effectiveTotal = deliveryTotal > 0 ? deliveryTotal : totalUnits;

      const progressPercent = calculateShipmentProgress(data);
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
        packageBreakdown: breakdown,

        // Calculated Metrics for Dashboard
        metrics: {
          totalContent: effectiveTotal,
          totalPackages: data.totals?.totalItems || 0,
          totalDelivered: deliveredUnits,
          totalLoaded: loadedUnits,
          checkerLoaded,
          progressPercent,
          loadPercent, // Shows how many Sacks/Bundles are actually on the truck
        },

        truckDetails: assignedTrip
          ? {
              tripId: assignedTrip.tripId,
              driverName: assignedTrip.driverName || "Unassigned",
              truckPlate: assignedTrip.truckPlateNumber || "N/A",
              status: assignedTrip.status,
              manifestLocked: assignedTrip.manifestLocked === true,
              manifestStatus: assignedTrip.manifestStatus || null,
              reconciledAt: assignedTrip.reconciledAt || null,
              receivingStartedAt: assignedTrip.receivingStartedAt || null,
              delayCleared: assignedTrip.delayCleared,
              delayReason: assignedTrip.delayReason || null,
            }
          : null,
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
