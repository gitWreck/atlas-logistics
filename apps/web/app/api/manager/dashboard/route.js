import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 2. CHECK ROLE
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (
      !userData ||
      !["admin", "manager", "driver", "checker"].includes(
        userData.role?.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Staff Access Only" },
        { status: 403 },
      );
    }

    // 1. Parse Query Parameters
    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") || "7d"; // Default to 7 days
    const limitParam = parseInt(searchParams.get("limit") || "5");

    // 2. Calculate Start Date
    const now = new Date();
    let startDate = new Date();

    // Simple logic to mimic 'getStartDate'
    switch (rangeParam) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "7d":
      default:
        startDate.setDate(now.getDate() - 7);
        break;
    }

    // Convert JS Date to Firestore Timestamp for accurate comparison
    const startTimestamp = Timestamp.fromDate(startDate);

    // 3. Define Reference
    const shipmentsRef = adminDb.collection("shipments");

    // 4. Prepare Queries (Admin SDK Syntax)
    // Note: Admin SDK uses .count().get() instead of getCountFromServer()

    // A. Total (updatedAt >= startDate)
    const qTotal = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .count()
      .get();

    // B. Delayed (updatedAt >= startDate AND status == DELAYED)
    const qDelayed = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .where("status", "==", "DELAYED")
      .count()
      .get();

    // C. In Transit (updatedAt >= startDate AND status == IN_TRANSIT)
    const qInTransit = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .where("status", "==", "IN_TRANSIT")
      .count()
      .get();

    // D. Recent Activity Table (Order by updatedAt desc)
    const qRecent = shipmentsRef
      .orderBy("updatedAt", "desc")
      .limit(limitParam)
      .get();

    // 5. Execute All in Parallel
    const [snapTotal, snapDelayed, snapTransit, snapRecent] = await Promise.all(
      [qTotal, qDelayed, qInTransit, qRecent],
    );

    // 6. Format Data
    const recentShipments = snapRecent.docs.map((doc) => {
      const d = doc.data();
      // Serialize Timestamps to ISO strings for JSON safety
      return {
        id: doc.id,
        ...d,
        updatedAt: d.updatedAt?.toDate().toISOString() || null,
        createdAt: d.createdAt?.toDate().toISOString() || null,
      };
    });

    // 7. Return Response
    return NextResponse.json({
      stats: {
        total: snapTotal.data().count,
        delayed: snapDelayed.data().count,
        inTransit: snapTransit.data().count,
      },
      recentShipments,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
