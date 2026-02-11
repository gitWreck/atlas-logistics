import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic"; // Prevent caching

export async function GET(request) {
  try {
    // 1. AUTHENTICATION
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // 2. AUTHORIZATION (RBAC)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (
      !userData ||
      !["admin", "manager"].includes(userData.role?.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Forbidden: Management Access Only" },
        { status: 403 },
      );
    }

    // 3. FETCH TRUCKS
    // We order by status and then plate number for better organization
    const snapshot = await adminDb
      .collection("trucks")
      .orderBy("status", "asc")
      .orderBy("plateNumber", "asc")
      .get();

    // 4. TRANSFORM DATA
    const trucks = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Clean ISO string conversion for timestamps
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
        registrationExpiry: data.registrationExpiry || null,
        // Helper calculation for the frontend: PMS Health
        // Assuming 5000km is the service interval
        pmsDue: data.lastPmsOdometer ? data.lastPmsOdometer + 5000 : null,
      };
    });

    return NextResponse.json({ trucks });
  } catch (error) {
    console.error("API Error fetching trucks:", error);
    return NextResponse.json(
      { error: "Failed to fetch trucks", details: error.message },
      { status: 500 },
    );
  }
}
