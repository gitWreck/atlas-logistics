import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { processCheckerScan } from "../_lib/processCheckerScan";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    await getAuth().verifyIdToken(token);

    const body = await request.json();
    const barcode = body?.barcode || body?.packageId;
    const truckTripId = body?.truckTripId || body?.tripId;
    const newStatus = body?.newStatus || "LOADED";

    const result = await processCheckerScan({
      barcode,
      truckTripId,
      idToken: token,
      newStatus,
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
