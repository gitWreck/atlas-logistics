import { NextResponse } from "next/server";
import { processCheckerScan } from "../_lib/processCheckerScan";
import { getCheckerAccessContext } from "../_lib/checkerAccessHelpers.mjs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const access = await getCheckerAccessContext(request);
    if (access.error) return access.error;

    const body = await request.json();
    const barcode = body?.barcode || body?.packageId;
    const truckTripId = body?.truckTripId || body?.tripId;
    const newStatus = body?.newStatus || "LOADED";

    const result = await processCheckerScan({
      barcode,
      truckTripId,
      idToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim(),
      newStatus,
      checkerMunicipalities: access.assignedMunicipalities,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Checker scan API failed:", error);

    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Scan failed.",
      },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
