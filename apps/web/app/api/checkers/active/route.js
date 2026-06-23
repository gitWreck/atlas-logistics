import { NextResponse } from "next/server";
import { canAssignDeliveryRoutes } from "@/app/utility/deliveryRoutePermissions";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
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

    const checkers = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().fullName || doc.data().name || "Unknown Checker",
      email: doc.data().email || "",
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
