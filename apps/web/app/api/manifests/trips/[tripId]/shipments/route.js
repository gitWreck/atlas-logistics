import { NextResponse } from "next/server";
import { getManifestTripShipments } from "@/lib/manifestTripShipments";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { tripId } = await params;
    return getManifestTripShipments(tripId);
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 },
    );
  }
}
