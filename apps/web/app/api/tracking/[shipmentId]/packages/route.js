import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sanitizePublicPackages } from "@/lib/publicTrackingPackages";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const shipmentId = decodeURIComponent(String(params.shipmentId || "").trim());
    if (!shipmentId) {
      return NextResponse.json({ packages: [] }, { status: 400 });
    }

    const publicSnap = await adminDb
      .collection("tracking_public")
      .doc(shipmentId)
      .get();

    if (publicSnap.exists) {
      const publicPackages = publicSnap.data()?.packages;
      if (Array.isArray(publicPackages) && publicPackages.length > 0) {
        return NextResponse.json({
          packages: sanitizePublicPackages(publicPackages),
        });
      }
    }

    const shipmentSnap = await adminDb
      .collection("shipments")
      .doc(shipmentId)
      .get();

    if (!shipmentSnap.exists) {
      return NextResponse.json({ packages: [] }, { status: 404 });
    }

    const shipmentData = shipmentSnap.data() || {};
    if (
      shipmentData.isPubliclyVisible === false ||
      shipmentData.public === false
    ) {
      return NextResponse.json({ packages: [] }, { status: 404 });
    }

    return NextResponse.json({
      packages: sanitizePublicPackages(shipmentData.packages || []),
    });
  } catch (error) {
    console.error("Public tracking packages error:", error);
    return NextResponse.json(
      { packages: [], message: error.message || "Failed to load packages." },
      { status: 500 },
    );
  }
}
