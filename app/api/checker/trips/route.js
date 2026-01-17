import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin"; // Ensure you use Admin SDK

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("truck_trips")
      .where("active", "==", true)
      .where("status", "in", ["CREATED", "ASSIGNED", "LOADING"])
      .get();

    const trips = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, data: trips });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
