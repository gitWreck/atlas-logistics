import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { getUnloadBlockReason } from "@/app/utility/manifestStatus";

export async function POST(req) {
  try {
    // 1. Authenticate Request
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await adminAuth.verifyIdToken(token);

    const { scanCode, tripId, action } = await req.json();
    const cleanCode = String(scanCode || "").trim();

    // Server-side Trip Validation for Unloads
    if (action === "UNLOAD" && tripId) {
      const tripCheck = await adminDb
        .collection("truck_trips")
        .doc(tripId)
        .get();
      const tripData = tripCheck.data() || {};
      const tripType = String(tripData.tripType || "HUB_TRANSFER").toUpperCase();
      const isHubTransfer = tripType === "HUB_TRANSFER";
      const unloadBlockReason = isHubTransfer
        ? getUnloadBlockReason(tripData)
        : null;
      const tripStatus = String(tripData.status || "").trim().toUpperCase();
      const canUnload = isHubTransfer
        ? !unloadBlockReason
        : ["ARRIVED", "LOADED", "IN_TRANSIT"].includes(tripStatus);

      if (tripCheck.exists && !canUnload) {
        return NextResponse.json({
          found: false,
          message:
            unloadBlockReason ||
            (isHubTransfer
              ? "Start receiving on this trip before unloading packages."
              : "Trip must be ARRIVED, LOADED, or IN_TRANSIT before unloading."),
        });
      }
    }

    if (!cleanCode) {
      return NextResponse.json(
        { error: "No scan code provided" },
        { status: 400 },
      );
    }

    // 2. Search Strategy: Shipment ID first, then Package ID
    let shipmentDoc = await adminDb
      .collection("shipments")
      .doc(cleanCode)
      .get();
    let isShipmentScan = shipmentDoc.exists;
    let targetPackage = null;

    if (!isShipmentScan) {
      const pkgQuery = await adminDb
        .collection("shipments")
        .where("packageBarcodes", "array-contains", cleanCode)
        .limit(1)
        .get();

      if (!pkgQuery.empty) {
        shipmentDoc = pkgQuery.docs[0];
        const data = shipmentDoc.data();
        targetPackage = data.packages?.find(
          (p) => p.packageId === cleanCode || p.trackingNumber === cleanCode,
        );
      }
    }

    if (!shipmentDoc.exists) {
      return NextResponse.json({
        found: false,
        message: "Label not found in system.",
      });
    }

    const data = shipmentDoc.data();
    const packageTripId =
      targetPackage?.currentTripId || targetPackage?.loadedOnTrip || null;
    const shipmentTripIds = Array.isArray(data.currentTripIds)
      ? data.currentTripIds
      : data.currentTripId
        ? [data.currentTripId]
        : [];
    const shipmentAssignedToTrip =
      data.currentTripId === tripId || shipmentTripIds.includes(tripId);
    let packageAssignmentState = "SHIPMENT_SCAN";

    if (targetPackage) {
      if (packageTripId === tripId) {
        packageAssignmentState = "ON_THIS_TRIP";
      } else if (!packageTripId) {
        packageAssignmentState = shipmentTripIds.length
          ? "UNASSIGNED_PACKAGE_FROM_ASSIGNED_SHIPMENT"
          : "UNASSIGNED_PACKAGE";
      } else {
        packageAssignmentState = "ON_OTHER_TRIP";
      }
    }

    // 3. Construct Response
    return NextResponse.json({
      found: true,
      label: cleanCode,
      scanType: isShipmentScan ? "SHIPMENT" : "PACKAGE",
      shipmentId: data.shipmentId,
      packageId: targetPackage ? targetPackage.packageId : null,
      trackingNumber: targetPackage ? targetPackage.trackingNumber : null,
      packageCurrentTripId: packageTripId,
      shipmentCurrentTripIds: shipmentTripIds,
      packageAssignmentState,
      status: targetPackage ? targetPackage.status : data.status,
      destination: data.recipient?.city || data.destination || "Unknown",
      recipientName: data.recipient?.name || "N/A",

      // Send the full packages array so the frontend can build the manifest
      packages: data.packages || [],

      // If the current assigned trip doesn't match the active scanner trip, flag it
      requiresAssignment: targetPackage
        ? packageAssignmentState === "ON_OTHER_TRIP"
        : !shipmentAssignedToTrip,
      shipmentAssignedToTrip,
    });
  } catch (error) {
    console.error("Resolve API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 },
    );
  }
}
