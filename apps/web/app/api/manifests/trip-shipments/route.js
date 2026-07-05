import { NextResponse } from "next/server";
import { getManifestTripShipments } from "@/lib/manifestTripShipments";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const tripId = request.nextUrl.searchParams.get("tripId");
    return getManifestTripShipments(tripId);
  } catch (error) {
    console.error("API Error fetching manifest trip shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 },
    );
  }
}
