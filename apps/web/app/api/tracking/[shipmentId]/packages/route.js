import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sanitizePublicPackages } from "@/lib/publicTrackingPackages";
import { getTrackingLookupCandidates } from "@/lib/publicTrackingResolve";

export const dynamic = "force-dynamic";

async function findPublicShipment(candidates = []) {
  for (const candidate of candidates) {
    const shipmentSnap = await adminDb
      .collection("shipments")
      .doc(candidate)
      .get();

    if (!shipmentSnap.exists) {
      continue;
    }

    const shipmentData = shipmentSnap.data() || {};
    if (
      shipmentData.isPubliclyVisible === false ||
      shipmentData.public === false
    ) {
      continue;
    }

    return { shipmentSnap, shipmentData };
  }

  return null;
}

export async function GET(_request, { params }) {
  try {
    const { shipmentId: rawId } = await params;
    const shipmentId = decodeURIComponent(String(rawId || "").trim());
    if (!shipmentId) {
      return NextResponse.json({ packages: [] }, { status: 400 });
    }

    const candidates = getTrackingLookupCandidates(shipmentId);
    const resolved = await findPublicShipment(candidates);

    if (!resolved) {
      return NextResponse.json({ packages: [] }, { status: 404 });
    }

    const { shipmentData } = resolved;
    const shipmentPackages = Array.isArray(shipmentData.packages)
      ? shipmentData.packages
      : [];

    if (shipmentPackages.length > 0) {
      return NextResponse.json({
        packages: sanitizePublicPackages(shipmentPackages),
      });
    }

    for (const candidate of candidates) {
      const publicSnap = await adminDb
        .collection("tracking_public")
        .doc(candidate)
        .get();

      if (!publicSnap.exists) {
        continue;
      }

      const publicPackages = publicSnap.data()?.packages;
      if (Array.isArray(publicPackages) && publicPackages.length > 0) {
        return NextResponse.json({
          packages: sanitizePublicPackages(publicPackages),
        });
      }
    }

    return NextResponse.json({ packages: [] });
  } catch (error) {
    console.error("Public tracking packages error:", error);
    return NextResponse.json(
      { packages: [], message: error.message || "Failed to load packages." },
      { status: 500 },
    );
  }
}
