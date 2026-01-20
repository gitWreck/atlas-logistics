import { NextResponse } from "next/server";
import { adminDb } from "@/apps/web/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // 1. Auth Check (Admin/Manager only)
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!["admin", "manager"].includes(userDoc.data()?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Query Active Drivers
    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "driver")
      .where("active", "==", true)
      .get();

    // 3. Transform Data
    const drivers = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "Unknown Driver",
      email: doc.data().email || "",
      // Add license number or other fields if you have them
    }));

    return NextResponse.json({ drivers });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drivers" },
      { status: 500 },
    );
  }
}
