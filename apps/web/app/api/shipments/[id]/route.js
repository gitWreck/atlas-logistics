import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatShipmentForBoard } from "@/app/utility/shipmentBoardFormatter";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params; // Shipment ID (e.g. trackingDocId)

    if (!id)
      return NextResponse.json({ error: "ID required" }, { status: 400 });

    // 1. Auth Check (Security)
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    // 2. Fetch from the ROOT "shipments" collection
    const docRef = adminDb.collection("shipments").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    // 3. Return the full data (including packages array)
    return NextResponse.json({
      shipment: formatShipmentForBoard(docSnap.data(), { id: docSnap.id }),
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
