import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

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
        targetPackage = data.packages?.find((p) => p.packageId === cleanCode);
      }
    }

    if (!shipmentDoc.exists) {
      return NextResponse.json({
        found: false,
        message: "Label not found in system.",
      });
    }

    const data = shipmentDoc.data();

    // 3. Construct Response
    return NextResponse.json({
      found: true,
      label: cleanCode,
      scanType: isShipmentScan ? "SHIPMENT" : "PACKAGE",
      shipmentId: data.shipmentId,
      packageId: targetPackage ? targetPackage.packageId : null,
      status: targetPackage ? targetPackage.status : data.status,
      destination: data.recipient?.city || data.destination || "Unknown",
      recipientName: data.recipient?.name || "N/A",

      // Send the full packages array so the frontend can build the manifest
      packages: data.packages || [],

      // If the current assigned trip doesn't match the active scanner trip, flag it
      requiresAssignment: data.currentTripId !== tripId,
    });
  } catch (error) {
    console.error("Resolve API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 },
    );
  }
}
