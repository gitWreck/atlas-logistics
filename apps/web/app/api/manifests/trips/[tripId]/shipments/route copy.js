import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    // 1. Get Trip ID from URL
    // Await params if using Next.js 15
    const { tripId } = await params;

    if (!tripId) {
      return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
    }

    // 2. Auth Check
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // 3. Role Check (Optional but recommended)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();
    if (
      !userData ||
      !["admin", "manager"].includes(userData.role?.toLowerCase())
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Fetch the Sub-Collection
    const snapshot = await adminDb
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .orderBy("createdAt", "desc") // Optional sorting
      .get();

    // 5. Transform Data
    const shipments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Timestamps to Strings
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
      };
    });

    return NextResponse.json({ shipments });
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 },
    );
  }
}
