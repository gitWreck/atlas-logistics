import { NextResponse } from "next/server";
import { admin, adminDb } from "@/lib/firebase-admin";
import { getCheckerAccessContext, isShipmentInCheckerMunicipalities } from "../_lib/checkerAccessHelpers.mjs";

async function getTripIdsForMunicipality(assignedMunicipalities = []) {
  const shipmentSnapshot = await adminDb
    .collection("shipments")
    .where("municipality", "in", assignedMunicipalities)
    .limit(1000)
    .get();

  const tripIds = new Set();
  shipmentSnapshot.docs.forEach((doc) => {
    const shipmentData = doc.data() || {};
    if (!isShipmentInCheckerMunicipalities(shipmentData, assignedMunicipalities)) return;
    if (shipmentData.currentTripId) tripIds.add(shipmentData.currentTripId);
    if (shipmentData.currentTruckTripId) tripIds.add(shipmentData.currentTruckTripId);
  });

  return [...tripIds];
}

export async function GET(request) {
  try {
    const access = await getCheckerAccessContext(request);
    if (access.error) return access.error;

    const tripIds = await getTripIdsForMunicipality(access.assignedMunicipalities);

    if (!tripIds.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const chunks = [];
    for (let index = 0; index < tripIds.length; index += 10) {
      chunks.push(tripIds.slice(index, index + 10));
    }

    const tripDocs = [];
    for (const chunk of chunks) {
      const snapshot = await adminDb
        .collection("truck_trips")
        .where(admin.firestore.FieldPath.documentId(), "in", chunk)
        .where("active", "==", true)
        .where("status", "in", ["CREATED", "ASSIGNED", "LOADING"])
        .get();
      tripDocs.push(...snapshot.docs);
    }

    const trips = tripDocs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, data: trips });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
