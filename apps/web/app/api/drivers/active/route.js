import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { managerCanAccessRecord } from "@/lib/managerAccess";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // 1. Auth Check (Admin/Manager only)
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    const requesterData = userDoc.data() || {};
    if (!["admin", "manager"].includes(requesterData.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Query Active Drivers
    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "driver")
      .where("active", "==", true)
      .get();

    // 3. Transform Data
    const drivers = snapshot.docs
      .filter((doc) => managerCanAccessRecord(requesterData, doc.data()))
      .map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown Driver",
        email: doc.data().email || "",
        warehouseName: doc.data().warehouseName || "",
        warehouseCode: doc.data().warehouseCode || "",
        assignedMunicipalities: Array.isArray(doc.data().assignedMunicipalities)
          ? doc.data().assignedMunicipalities
          : [],
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
