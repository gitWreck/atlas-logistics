import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("tripId");

    if (!tripId) {
      return NextResponse.json(
        { success: false, error: "Missing tripId" },
        { status: 400 },
      );
    }

    // Adjust this path if you are using root 'shipments' collection query instead
    const snapshot = await adminDb
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .get();

    const shipments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, data: shipments });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
