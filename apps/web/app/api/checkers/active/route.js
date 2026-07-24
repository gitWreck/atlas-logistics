import { NextResponse } from "next/server";
import { canAssignDeliveryRoutes } from "@/app/utility/deliveryRoutePermissions";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { managerCanAccessRecord } from "@/lib/managerAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const requesterSnap = await adminDb.collection("users").doc(uid).get();
    const requesterData = requesterSnap.data() || {};
    const requesterRole = String(requesterData.role || "").toLowerCase();
    if (
      !canAssignDeliveryRoutes({
        role: requesterRole,
        email: requesterData.email || decodedToken.email,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "checker")
      .where("active", "==", true)
      .get();

    const checkers = snapshot.docs
      .filter((doc) => managerCanAccessRecord(requesterData, doc.data()))
      .map((doc) => ({
        id: doc.id,
        name: doc.data().fullName || doc.data().name || "Unknown Checker",
        email: doc.data().email || "",
        warehouseName: doc.data().warehouseName || "",
        warehouseCode: doc.data().warehouseCode || "",
        assignedMunicipalities: Array.isArray(doc.data().assignedMunicipalities)
          ? doc.data().assignedMunicipalities
          : [],
      }));

    return NextResponse.json({ checkers });
  } catch (error) {
    console.error("API Error fetching checkers:", error);
    return NextResponse.json(
      { error: "Failed to fetch checkers" },
      { status: 500 },
    );
  }
}
