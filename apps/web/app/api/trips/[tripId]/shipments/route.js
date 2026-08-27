import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
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

function hasValue(value) {
  if (value === undefined || value === null) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

function mergeNonEmptyFields(fallback = {}, preferred = {}) {
  const merged = {
    ...(fallback && typeof fallback === "object" ? fallback : {}),
  };

  if (!preferred || typeof preferred !== "object") return merged;

  Object.entries(preferred).forEach(([key, value]) => {
    if (hasValue(value)) merged[key] = value;
  });

  return merged;
}

function contactFromShipment(shipment = {}, type) {
  const nested =
    shipment?.[type] && typeof shipment[type] === "object"
      ? shipment[type]
      : {};
  const legacyAddress = shipment?.[`${type}Address`];

  return {
    ...nested,
    name:
      nested.name ||
      shipment?.[`${type}Name`] ||
      (type === "sender" ? shipment?.customerName : "") ||
      "",
    phone:
      nested.phone ||
      shipment?.[`${type}Phone`] ||
      (type === "sender" ? shipment?.customerPhoneNumber : "") ||
      "",
    address:
      nested.address ||
      nested.details ||
      (legacyAddress && typeof legacyAddress === "object"
        ? legacyAddress
        : {}),
    formattedAddress:
      nested.formattedAddress ||
      (typeof legacyAddress === "string" ? legacyAddress : ""),
  };
}

function mergeShipmentContact(preferredShipment, fallbackShipment, type) {
  const preferred = contactFromShipment(preferredShipment, type);
  const fallback = contactFromShipment(fallbackShipment, type);
  const merged = mergeNonEmptyFields(fallback, preferred);

  merged.address = mergeNonEmptyFields(
    fallback.address,
    preferred.address,
  );

  return merged;
}

async function fetchRootShipmentsById(shipmentIds = []) {
  const uniqueIds = [...new Set(shipmentIds.filter(Boolean))];
  const rootShipments = new Map();
  const batchSize = 100;

  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const chunk = uniqueIds.slice(index, index + batchSize);
    const snapshots = await adminDb.getAll(
      ...chunk.map((id) => adminDb.collection("shipments").doc(id)),
    );

    snapshots.forEach((snapshot) => {
      if (snapshot.exists) {
        rootShipments.set(snapshot.id, {
          id: snapshot.id,
          ...serializeFirestoreValue(snapshot.data()),
        });
      }
    });
  }

  return rootShipments;
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

    const decodedToken = await adminAuth.verifyIdToken(token);
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
    const [byTripIdSnap, byTripIdsArraySnap, manifestSnap] = await Promise.all([
      adminDb
        .collection("shipments")
        .where("currentTripId", "==", tripId)
        .get(),
      adminDb
        .collection("shipments")
        .where("currentTripIds", "array-contains", tripId)
        .get()
        .catch(() => ({ docs: [] })),
      tripRef.collection("trip_shipments").get(),
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

    // Completed hub handoffs clear currentTripId from the master shipment.
    // The trip manifest remains the historical source of membership, so merge
    // those rows with the current master documents for complete invoice data.
    const manifestRows = new Map();
    manifestSnap.docs.forEach((doc) => {
      const data = serializeFirestoreValue(doc.data());
      const rootShipmentId = data.trackingShipmentId || doc.id;
      manifestRows.set(rootShipmentId, {
        id: rootShipmentId,
        ...data,
      });
    });

    const rootShipments = await fetchRootShipmentsById([
      ...manifestRows.keys(),
    ]);

    manifestRows.forEach((manifestRow, shipmentId) => {
      const rootShipment = rootShipments.get(shipmentId);
      shipmentMap.set(shipmentId, {
        ...manifestRow,
        ...(rootShipment || {}),
        sender: mergeShipmentContact(
          rootShipment || {},
          manifestRow,
          "sender",
        ),
        recipient: mergeShipmentContact(
          rootShipment || {},
          manifestRow,
          "recipient",
        ),
        id: shipmentId,
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
