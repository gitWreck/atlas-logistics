import { NextResponse } from "next/server";
import { admin, adminDb } from "@/lib/firebase-admin";
import {
  getCheckerAccessContext,
  getCheckerMunicipalityFilter,
} from "../_lib/checkerAccessHelpers.mjs";

export async function GET(request) {
  try {
    const access = await getCheckerAccessContext(request);
    if (access.error) return access.error;

    const { assignedMunicipalities } = access;
    const municipalityFilter = getCheckerMunicipalityFilter(assignedMunicipalities);

    if (!municipalityFilter) {
      return NextResponse.json({ success: false, message: "No municipality assigned" }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfDayTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);
    const shipmentsRef = adminDb.collection("shipments");

    const receivedQuery = shipmentsRef
      .where("createdAt", ">=", startOfDayTimestamp)
      .where(municipalityFilter.field, municipalityFilter.operator, municipalityFilter.value)
      .count()
      .get();

    const outForDeliveryQuery = shipmentsRef
      .where("status", "==", "OUT_FOR_DELIVERY")
      .where("updatedAt", ">=", startOfDayTimestamp)
      .where(municipalityFilter.field, municipalityFilter.operator, municipalityFilter.value)
      .count()
      .get();

    const pendingQuery = shipmentsRef
      .where("status", "==", "RECEIVED")
      .where(municipalityFilter.field, municipalityFilter.operator, municipalityFilter.value)
      .count()
      .get();

    const historyQuery = shipmentsRef
      .where("status", "==", "OUT_FOR_DELIVERY")
      .where(municipalityFilter.field, municipalityFilter.operator, municipalityFilter.value)
      .orderBy("updatedAt", "desc")
      .limit(10)
      .get();

    const [receivedSnap, outForDeliverySnap, pendingSnap, historySnap] =
      await Promise.all([
        receivedQuery,
        outForDeliveryQuery,
        pendingQuery,
        historyQuery,
      ]);

    const recentShipments = historySnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        shipmentId: d.shipmentId,
        receiver: d.receiverName || "Unknown",
        area: d.destinationCity || d.destinationArea || "N/A",
        truck: d.currentTruckPlate || "—",
        status: d.status,
      };
    });

    return NextResponse.json({
      stats: {
        received: receivedSnap.data().count,
        outForDelivery: outForDeliverySnap.data().count,
        pending: pendingSnap.data().count,
      },
      recentShipments,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
