import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic"; // Prevent caching

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

    if (
      !userData ||
      !["admin", "manager"].includes(userData.role?.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Forbidden: Managers Only" },
        { status: 403 },
      );
    }

    // 3. FETCH TRIPS
    const snapshot = await adminDb
      .collection("truck_trips")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    // 4. TRANSFORM DATA
    // Convert Firestore Timestamps to Strings for JSON
    const trips = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
        // lastUpdatedAt: data.lastUpdatedAt?.toDate
        //   ? data.lastUpdatedAt.toDate().toISOString()
        //   : null,

        // Ensure numbers are safe (optional)
        packageTotal: data.packageTotal || 0,
      };
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("API Error fetching trips:", error);
    return NextResponse.json(
      { error: "Failed to fetch trips", details: error.message },
      { status: 500 },
    );
  }
}
