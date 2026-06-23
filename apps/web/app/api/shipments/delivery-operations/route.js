import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  resolveShipmentDeliveryMetrics,
  calculateShipmentProgress,
} from "@/app/utility/shipmentProgress";
import { resolveShipmentPackageBreakdown } from "@/app/utility/packageStatus";
import { shipmentMatchesDeliveryCheckerPool } from "@/app/utility/deliveryOperationsCheckers";

export const dynamic = "force-dynamic";

const DELIVERY_QUERY_STATUSES = [
  "OUT_FOR_DELIVERY",
  "PARTIALLY_OUT_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "FAILED_DELIVERY",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
];

const SHIPMENT_REF_PATTERN = /^AT-\d{8}-SHP-[A-Z0-9-]+(?:-\d{2})?$/i;

function chunkArray(values = [], size = 30) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?._seconds) return value._seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatShipmentDoc(doc, tripMap = {}) {
  const data = doc.data();
  const assignedTrip = data.currentTripId ? tripMap[data.currentTripId] : null;

  const totalUnits =
    data.totals?.totalContentQty || data.totals?.totalItems || 1;
  const loadedUnits = data.totals?.loaded || 0;
  const breakdown = resolveShipmentPackageBreakdown(data);
  const checkerLoaded = Math.max(
    Number(breakdown.outForDelivery || 0),
    Number(breakdown.onCheckerVan || 0),
  );
  const { total: deliveryTotal, delivered: deliveredUnits } =
    resolveShipmentDeliveryMetrics(data);
  const effectiveTotal = deliveryTotal > 0 ? deliveryTotal : totalUnits;

  const progressPercent = calculateShipmentProgress(data);
  const loadPercent = Math.round(
    (loadedUnits / (data.totals?.totalItems || 1)) * 100,
  );

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt ? formatFirestoreDate(data.createdAt) : null,
    updatedAt: data.updatedAt ? formatFirestoreDate(data.updatedAt) : null,
    metrics: {
      totalContent: effectiveTotal,
      totalPackages: data.totals?.totalItems || 0,
      totalDelivered: deliveredUnits,
      totalLoaded: loadedUnits,
      checkerLoaded,
      progressPercent,
      loadPercent,
    },
    truckDetails: assignedTrip
      ? {
          tripId: assignedTrip.tripId,
          driverName: assignedTrip.driverName || "Unassigned",
          truckPlate: assignedTrip.truckPlateNumber || "N/A",
          status: assignedTrip.status,
          manifestLocked: assignedTrip.manifestLocked === true,
          manifestStatus: assignedTrip.manifestStatus || null,
          reconciledAt: assignedTrip.reconciledAt || null,
          receivingStartedAt: assignedTrip.receivingStartedAt || null,
          delayCleared: assignedTrip.delayCleared,
          delayReason: assignedTrip.delayReason || null,
        }
      : null,
  };
}

async function fetchActiveCheckerIds() {
  const snap = await adminDb
    .collection("users")
    .where("role", "==", "checker")
    .limit(200)
    .get();

  return snap.docs.map((docSnap) => docSnap.id).filter(Boolean);
}

async function resolveShipmentByRef(shipmentRef) {
  const clean = String(shipmentRef || "").trim();
  if (!clean || !SHIPMENT_REF_PATTERN.test(clean)) return null;

  const directSnap = await adminDb.collection("shipments").doc(clean).get();
  if (directSnap.exists) return directSnap;

  const byPublicIdSnap = await adminDb
    .collection("shipments")
    .where("shipmentId", "==", clean)
    .limit(1)
    .get();

  return byPublicIdSnap.empty ? null : byPublicIdSnap.docs[0];
}

export async function GET(request) {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
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
    const shipmentRef = String(searchParams.get("shipmentRef") || "").trim();
    const perQueryLimit = Math.min(
      Number(searchParams.get("limit") || "150"),
      300,
    );

    const docMap = new Map();

    if (shipmentRef) {
      const resolved = await resolveShipmentByRef(shipmentRef);
      if (resolved) {
        docMap.set(resolved.id, resolved);
      }
    }

    const statusQueries = DELIVERY_QUERY_STATUSES.map((status) =>
      adminDb
        .collection("shipments")
        .where("status", "==", status)
        .limit(perQueryLimit)
        .get(),
    );

    const checkerIds = await fetchActiveCheckerIds();
    const checkerQueries = chunkArray(checkerIds, 30).map((chunk) =>
      adminDb
        .collection("shipments")
        .where("activeCheckerIds", "array-contains-any", chunk)
        .limit(perQueryLimit)
        .get(),
    );

    const snapshots = await Promise.all([...statusQueries, ...checkerQueries]);

    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        if (docSnap.data().isPickupRequested === true) return;
        docMap.set(docSnap.id, docSnap);
      });
    });

    const docs = [...docMap.values()].filter((docSnap) =>
      shipmentMatchesDeliveryCheckerPool(docSnap.data() || {}),
    );

    docs.sort(
      (a, b) =>
        getTimestampMs(b.data()?.updatedAt) - getTimestampMs(a.data()?.updatedAt),
    );

    const uniqueTripIds = new Set();
    docs.forEach((docSnap) => {
      const tripId = docSnap.data().currentTripId;
      if (tripId) uniqueTripIds.add(tripId);
    });

    let tripMap = {};
    if (uniqueTripIds.size > 0) {
      const tripRefs = Array.from(uniqueTripIds).map((id) =>
        adminDb.collection("truck_trips").doc(id),
      );
      const tripSnapshots = await adminDb.getAll(...tripRefs);
      tripSnapshots.forEach((snap) => {
        if (snap.exists) {
          tripMap[snap.id] = snap.data();
        }
      });
    }

    const shipments = docs.map((docSnap) => formatShipmentDoc(docSnap, tripMap));

    return NextResponse.json({ shipments });
  } catch (error) {
    console.error("API Error fetching delivery operations shipments:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch delivery operations shipments",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
