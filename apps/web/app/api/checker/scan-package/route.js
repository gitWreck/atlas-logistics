import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin"; // Use the ADMIN db

export async function POST(request) {
  try {
    const { barcode, truckTripId } = await request.json();

    // 1. Find the Shipment containing this Barcode
    // Note: We search the 'packages' array for an object with this barcode
    const snapshot = await db
      .collection("shipments")
      .where("packageBarcodes", "array-contains", barcode) // Helper field for fast search
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 },
      );
    }

    const doc = snapshot.docs[0];
    const shipment = doc.data();
    const shipmentRef = doc.ref;

    // 2. Find the specific package index
    const pkgIndex = shipment.packages.findIndex((p) => p.barcode === barcode);
    if (pkgIndex === -1) throw new Error("Data mismatch");

    const targetPkg = shipment.packages[pkgIndex];

    // 3. Check Logic
    if (targetPkg.status === "LOADED") {
      return NextResponse.json(
        { success: false, message: "Already Loaded!" },
        { status: 400 },
      );
    }

    // 4. UPDATE (Atomic Transaction)
    await db.runTransaction(async (t) => {
      // Re-read for safety
      const freshSnap = await t.get(shipmentRef);
      const freshData = freshSnap.data();
      const freshPackages = freshData.packages;

      // Update the specific package
      freshPackages[pkgIndex].status = "LOADED";
      freshPackages[pkgIndex].loadedAt = new Date().toISOString();
      freshPackages[pkgIndex].loadedOnTrip = truckTripId;

      // Recalculate Totals
      const loadedCount = freshPackages.filter(
        (p) => p.status === "LOADED",
      ).length;
      const totalCount = freshPackages.length;

      const newStatus =
        loadedCount === totalCount ? "LOADED" : "PARTIALLY_LOADED";

      t.update(shipmentRef, {
        packages: freshPackages,
        loadedCount: loadedCount,
        status: newStatus,
        lastUpdatedAt: new Date(),
      });

      // OPTIONAL: Also update the Truck Trip manifest here if you want real-time counts on the truck doc
    });

    return NextResponse.json({
      success: true,
      message: "Package Verified",
      progress: `${targetPkg.suffixId} / ${shipment.totalPackages}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
