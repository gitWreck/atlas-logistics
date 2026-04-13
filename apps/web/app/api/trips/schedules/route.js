import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function toIsoOrNull(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value || null;
}

export async function GET() {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (
      !userData ||
      !["admin", "manager"].includes(String(userData.role || "").toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Forbidden: Managers Only" },
        { status: 403 },
      );
    }

    const snapshot = await adminDb
      .collection("truck_trips")
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();

    const trips = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        tripId: data.tripId || doc.id,

        origin: data.origin || "",
        originCode: data.originCode || "",
        destination: data.destination || "",
        destinationCode: data.destinationCode || "",
        route: data.route || "",
        tripType: data.tripType || "",

        truckId: data.truckId || null,
        truckPlateNumber: data.truckPlateNumber || "",
        driverId: data.driverId || null,
        driverName: data.driverName || "",
        driverPhone: data.driverPhone || "",

        helperName: data.helperName || null,

        plannedLoadingStart: toIsoOrNull(data.plannedLoadingStart),
        plannedLoadingEnd: toIsoOrNull(data.plannedLoadingEnd),
        plannedDeparture: toIsoOrNull(data.plannedDeparture),
        estimatedArrival: toIsoOrNull(data.estimatedArrival),

        actualLoadingStart: toIsoOrNull(data.actualLoadingStart),
        actualLoadingEnd: toIsoOrNull(data.actualLoadingEnd),
        actualDeparture: toIsoOrNull(data.actualDeparture),
        actualArrival: toIsoOrNull(data.actualArrival),

        status: data.status || "",
        statusIndex: data.statusIndex ?? 0,
        active: data.active !== false,

        totalItems: Number(data.totalItems || 0),
        totalLoaded: Number(data.totalLoaded || 0),
        totalDelivered: Number(data.totalDelivered || 0),
        totalReceived: Number(data.totalReceived || 0),
        totalMissing: Number(data.totalMissing || 0),
        itemPending: Number(data.itemPending || 0),

        delayReason: data.delayReason || null,
        delayStartedAt: toIsoOrNull(data.delayStartedAt),
        delayClearedAt: toIsoOrNull(data.delayClearedAt),

        createdAt: toIsoOrNull(data.createdAt),
        createdBy: data.createdBy || null,
        createdRole: data.createdRole || null,
        updatedAt: toIsoOrNull(data.updatedAt),
        updatedBy: data.updatedBy || null,
        updatedRole: data.updatedRole || null,
      };
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("API Error fetching trips:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch trips",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
