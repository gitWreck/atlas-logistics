import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic"; // Prevent caching

const COMPLETED_TRIP_STATUSES = ["COMPLETED", "DELIVERED"];
const COMPLETED_TRIP_STATUS_SET = new Set(COMPLETED_TRIP_STATUSES);

function parseLimit(searchParams, key) {
  const limitParam = searchParams.get(key) || searchParams.get("limit") || "50";
  const allowedLimits = ["all", "50", "100", "200"];

  if (!allowedLimits.includes(limitParam)) {
    throw new Error(`Invalid ${key}. Use all, 50, 100, or 200.`);
  }

  return limitParam;
}

export async function GET(request) {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decodedToken = await getAuth().verifyIdToken(token);
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

    const { searchParams } = new URL(request.url);
    const activeLimit = parseLimit(searchParams, "activeLimit");
    const completedLimit = parseLimit(searchParams, "completedLimit");

    // 3. FETCH TRIPS PARENT DOCS
    const snapshot = await adminDb
      .collection("truck_trips")
      .orderBy("updatedAt", "desc")
      .get();

    const activeDocs = snapshot.docs.filter(
      (doc) =>
        !COMPLETED_TRIP_STATUS_SET.has(
          String(doc.data().status || "").toUpperCase(),
        ),
    );
    const completedDocs = snapshot.docs.filter((doc) =>
      COMPLETED_TRIP_STATUS_SET.has(
        String(doc.data().status || "").toUpperCase(),
      ),
    );
    const limitedActiveDocs =
      activeLimit === "all" ? activeDocs : activeDocs.slice(0, Number(activeLimit));
    const limitedCompletedDocs =
      completedLimit === "all"
        ? completedDocs
        : completedDocs.slice(0, Number(completedLimit));

    const tripDocs = new Map();
    [...limitedActiveDocs, ...limitedCompletedDocs].forEach((doc) => {
      tripDocs.set(doc.id, doc);
    });

    // 4. TRANSFORM DATA & FETCH SUBCOLLECTIONS
    // We use Promise.all to fetch subcollections in parallel
    const trips = await Promise.all(
      Array.from(tripDocs.values()).map(async (doc) => {
        const data = doc.data();

        // A. Fetch the 'trip_shipments' subcollection for THIS trip
        const shipmentsSnapshot = await adminDb
          .collection("truck_trips")
          .doc(doc.id)
          .collection("trip_shipments")
          .get();

        // B. Map shipment docs to clean JSON
        const shipments = shipmentsSnapshot.docs.map((subDoc) => {
          const sData = subDoc.data();
          return {
            id: subDoc.id,
            ...sData,
            // Safety check for timestamps inside shipments if they exist
            createdAt: sData.createdAt?.toDate
              ? sData.createdAt.toDate().toISOString()
              : null,
          };
        });

        // C. Return the Parent Trip + The Array of Shipments
        return {
          id: doc.id,
          ...data,
          shipments: shipments, // <--- HERE IS YOUR ARRAY
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : null,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : null,
          packageTotal: data.packageTotal || 0,
        };
      }),
    );

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("API Error fetching trips:", error);
    return NextResponse.json(
      { error: "Failed to fetch trips", details: error.message },
      { status: error.message?.startsWith("Invalid ") ? 400 : 500 },
    );
  }
}
