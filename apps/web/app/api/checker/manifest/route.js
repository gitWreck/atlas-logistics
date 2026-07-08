import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getCheckerAccessContext, isShipmentInCheckerMunicipalities } from "../_lib/checkerAccessHelpers.mjs";

export async function GET(request) {
  try {
    const access = await getCheckerAccessContext(request);
    if (access.error) return access.error;

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("tripId");

    if (!tripId) {
      return NextResponse.json(
        { success: false, error: "Missing tripId" },
        { status: 400 },
      );
    }

    const snapshot = await adminDb
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .get();

    const shipmentIds = snapshot.docs
      .map((doc) => doc.data()?.shipmentId || doc.id)
      .filter(Boolean);

    const shipments = [];

    if (shipmentIds.length) {
      const shipmentDocs = await Promise.all(
        shipmentIds.map((shipmentId) => adminDb.collection("shipments").doc(shipmentId).get()),
      );

      shipmentDocs.forEach((shipmentDoc) => {
        if (!shipmentDoc.exists) return;
        const shipmentData = shipmentDoc.data();
        if (isShipmentInCheckerMunicipalities(shipmentData, access.assignedMunicipalities)) {
          shipments.push({ id: shipmentDoc.id, ...shipmentData });
        }
      });
    }

    return NextResponse.json({ success: true, data: shipments });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
