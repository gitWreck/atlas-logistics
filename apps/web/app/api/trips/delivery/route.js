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

    // Fetch up to 5 active trips (You can adjust this query based on how you tag Delivery trips)
    const tripsSnap = await adminDb
      .collection("truck_trips")
      .where("tripType", "==", "DEL")
      .where("status", "in", ["CREATED", "LOADED"]) // Only trips that haven't left yet
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const trips = tripsSnap.docs.map((doc) => ({
      id: doc.id,
      driverName: doc.data().driverName || "Unassigned Driver",
      truckPlate: doc.data().truckPlateNumber || "No Plate",
    }));

    return NextResponse.json({ trips });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
