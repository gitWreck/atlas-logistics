import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const PICKUP_REQUEST_STATUSES = ["CREATED", "PENDING_PICKUP"];
const ACTIVE_TRIP_STATUSES = [
  "ASSIGNED",
  "LOADED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
];

export async function GET(request) {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role?.toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access only" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") || "today";

    const now = new Date();
    const startDate = new Date();

    switch (rangeParam) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "30days":
        startDate.setDate(now.getDate() - 30);
        break;
      case "7days":
      default:
        startDate.setDate(now.getDate() - 7);
        break;
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    const shipmentsRef = adminDb.collection("shipments");

    const activeTripsPromises = ACTIVE_TRIP_STATUSES.map((status) =>
      shipmentsRef
        .where("updatedAt", ">=", startTimestamp)
        .where("status", "==", status)
        .count()
        .get(),
    );

    const pickupRequestsPromises = PICKUP_REQUEST_STATUSES.map((status) =>
      shipmentsRef
        .where("updatedAt", ">=", startTimestamp)
        .where("status", "==", status)
        // .where("isPickupRequest", "==", true)
        .count()
        .get(),
    );

    const delayedTripsPromise = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .where("delayCleared", "==", false)
      .count()
      .get();

    const deliveredTripsPromise = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .where("status", "==", "DELIVERED")
      .count()
      .get();

    const [
      activeTripsSnapshots,
      pickupRequestsSnapshots,
      delayedTripsSnapshot,
      deliveredTripsSnapshot,
    ] = await Promise.all([
      Promise.all(activeTripsPromises),
      Promise.all(pickupRequestsPromises),
      delayedTripsPromise,
      deliveredTripsPromise,
    ]);

    const activeTrips = activeTripsSnapshots.reduce(
      (sum, snap) => sum + snap.data().count,
      0,
    );

    const pickupRequests = pickupRequestsSnapshots.reduce(
      (sum, snap) => sum + snap.data().count,
      0,
    );

    const delayedTrips = delayedTripsSnapshot.data().count;
    const deliveredTrips = deliveredTripsSnapshot.data().count;

    return NextResponse.json({
      stats: {
        activeTrips,
        delayedTrips,
        pickupRequests,
        deliveredTrips,
      },
    });
  } catch (error) {
    console.error("Admin Overview API Error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
