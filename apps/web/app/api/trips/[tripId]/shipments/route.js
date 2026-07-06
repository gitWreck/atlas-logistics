import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function serializeFirestoreValue(value) {
  if (!value) return value;

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serializeFirestoreValue(val);
    }
    return out;
  }

  return value;
}

export async function GET(_req, context) {
  try {
    const { tripId } = await context.params;

    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

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
      !["admin", "manager", "driver", "checker"].includes(
        String(userData.role || "").toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Staff Access Only" },
        { status: 403 },
      );
    }

    const tripRef = adminDb.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Multi-trip shipments have currentTripId=null (pointer only set when on a
    // single trip), so also match on the currentTripIds array to avoid dropping
    // shipments split across trips.
    const [byTripIdSnap, byTripIdsArraySnap] = await Promise.all([
      adminDb
        .collection("shipments")
        .where("currentTripId", "==", tripId)
        .get(),
      adminDb
        .collection("shipments")
        .where("currentTripIds", "array-contains", tripId)
        .get()
        .catch(() => ({ docs: [] })),
    ]);

    const trip = {
      id: tripSnap.id,
      ...serializeFirestoreValue(tripSnap.data()),
    };

    const shipmentMap = new Map();
    [...byTripIdSnap.docs, ...byTripIdsArraySnap.docs].forEach((doc) => {
      shipmentMap.set(doc.id, {
        id: doc.id,
        ...serializeFirestoreValue(doc.data()),
      });
    });

    const shipments = [...shipmentMap.values()].sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || "") || 0;
      const bTime = Date.parse(b.updatedAt || "") || 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      trip,
      shipments,
    });
  } catch (error) {
    console.error("API Error fetching trip manifest:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch trip manifest",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
