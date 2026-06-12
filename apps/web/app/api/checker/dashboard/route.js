import { NextResponse } from "next/server";
import { db } from "@/lib/firebase"; // Ensure you have firebase-admin setup
import { admin } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    // 1. Calculate Date Range (Start of Today)
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfDayTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);

    // 2. Define References
    const shipmentsRef = db.collection("shipments"); // Assuming root collection for warehouse

    // 3. Prepare Queries (Parallel Execution for Speed)

    // A. Received Today (Created >= Today)
    const receivedQuery = shipmentsRef
      .where("createdAt", ">=", startOfDayTimestamp)
      .count()
      .get();

    // B. Out for delivery today (checker load scan sets this per piece)
    const outForDeliveryQuery = shipmentsRef
      .where("status", "==", "OUT_FOR_DELIVERY")
      .where("updatedAt", ">=", startOfDayTimestamp)
      .count()
      .get();

    // C. Pending / Floor (Status = RECEIVED) - Total backlog, not just today
    const pendingQuery = shipmentsRef
      .where("status", "==", "RECEIVED")
      .count()
      .get();

    // D. Recent outbound table (checker load → out for delivery)
    const historyQuery = shipmentsRef
      .where("status", "==", "OUT_FOR_DELIVERY")
      .orderBy("updatedAt", "desc")
      .limit(10)
      .get();

    // 4. Await All
    const [receivedSnap, outForDeliverySnap, pendingSnap, historySnap] =
      await Promise.all([
        receivedQuery,
        outForDeliveryQuery,
        pendingQuery,
        historyQuery,
      ]);

    // 5. Format Table Data
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
