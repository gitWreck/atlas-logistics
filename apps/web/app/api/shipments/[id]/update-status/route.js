import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { invokeCallable } from "@/lib/invokeCallable";

export const dynamic = "force-dynamic";

async function authorizeStaff() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  return { token, decodedToken };
}

export async function POST(request, { params }) {
  try {
    const auth = await authorizeStaff();
    if (auth.error) return auth.error;

    const { id: shipmentId } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await invokeCallable(
      "updateShipmentStatus",
      {
        shipmentId,
        newStatus: body.newStatus,
        remarks: body.remarks ?? null,
        notify: body.notify === true,
        notifySms: body.notifySms,
        notifyEmail: body.notifyEmail,
        notifyPush: body.notifyPush,
        tripId: body.tripId ?? null,
        sourceUI: body.sourceUI || "SHIPMENT_DRAWER",
        location: body.location ?? null,
      },
      auth.token,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("update-shipment-status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update shipment status." },
      { status: error.status || 500 },
    );
  }
}
