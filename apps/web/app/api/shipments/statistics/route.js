import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { managerCanAccessRecord } from "@/lib/managerAccess";

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
      !["admin", "manager", "driver", "checker"].includes(
        userData.role?.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Staff Access Only" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range") || "7days";
    const limitParam = parseInt(searchParams.get("limit") || "5", 10);

    const now = new Date();
    const startDate = new Date();

    switch (rangeParam) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;

      case "30days":
        startDate.setDate(now.getDate() - 30);
        break;

      case "7days":
      default:
        startDate.setDate(now.getDate() - 7);
        break;
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    const shipmentsRef = adminDb.collection("shipments");
    const role = String(userData.role || "").toLowerCase();

    if (role === "manager") {
      const scopedSnapshot = await shipmentsRef
        .where("updatedAt", ">=", startTimestamp)
        .get();
      const scoped = scopedSnapshot.docs
        .filter((doc) => managerCanAccessRecord(userData, doc.data()))
        .sort(
          (left, right) =>
            (right.data().updatedAt?.toMillis?.() || 0) -
            (left.data().updatedAt?.toMillis?.() || 0),
        );
      const recentShipments = scoped.slice(0, limitParam).map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          updatedAt: data.updatedAt?.toDate().toISOString() || null,
          createdAt: data.createdAt?.toDate().toISOString() || null,
        };
      });
      return NextResponse.json({
        stats: {
          total: scoped.length,
          delayed: scoped.filter((doc) => doc.data().delayCleared === false).length,
          inTransit: scoped.filter(
            (doc) => String(doc.data().status || "").toUpperCase() === "IN_TRANSIT",
          ).length,
        },
        recentShipments,
      });
    }

    const qTotal = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .count()
      .get();

    const qDelayed = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .where("delayCleared", "==", false)
      .count()
      .get();

    const qInTransit = shipmentsRef
      .where("updatedAt", ">=", startTimestamp)
      .where("status", "==", "IN_TRANSIT")
      .count()
      .get();

    const qRecent = shipmentsRef
      .orderBy("updatedAt", "desc")
      .limit(limitParam)
      .get();

    const [snapTotal, snapDelayed, snapTransit, snapRecent] = await Promise.all(
      [qTotal, qDelayed, qInTransit, qRecent],
    );

    const recentShipments = snapRecent.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        updatedAt: data.updatedAt?.toDate().toISOString() || null,
        createdAt: data.createdAt?.toDate().toISOString() || null,
      };
    });

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
