import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export async function GET(req) {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const tripsSnap = await adminDb
      .collection("truck_trips")
      .where("tripType", "==", "DELIVERY")
      .where("status", "in", ["CREATED", "ASSIGNED", "LOADING", "LOADED"])
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const trips = tripsSnap.docs.map((doc) => ({
      id: doc.id,
      driverName: doc.data().driverName || "Unassigned Driver",
      truckPlate: doc.data().truckPlateNumber || "No Plate",
      route: doc.data().route || doc.data().destination || "Delivery route",
      status: doc.data().status || "CREATED",
    }));

    return NextResponse.json({ trips });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
