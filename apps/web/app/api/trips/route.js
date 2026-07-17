import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";
import {
  MANIFEST_STATUS,
  isHubTransferTrip,
  resolveManifestStatus,
} from "@/app/utility/manifestStatus";
import { getTripScopedPackages } from "@/app/utility/tripScopedPackages";

export const dynamic = "force-dynamic"; // Prevent caching

const COMPLETED_TRIP_STATUSES = ["COMPLETED", "DELIVERED", "CANCELLED"];
const COMPLETED_TRIP_STATUS_SET = new Set(COMPLETED_TRIP_STATUSES);
const ACTIVE_TRIP_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "LOADING",
  "PARTIALLY_LOADED",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED",
  "UNLOADING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
];

function isActiveTripDoc(data = {}) {
  const status = String(data.status || "").toUpperCase();
  if (data.archived === true) return false;
  if (COMPLETED_TRIP_STATUS_SET.has(status)) return false;
  return true;
}

function isCompletedTripDoc(data = {}) {
  const status = String(data.status || "").toUpperCase();
  if (data.archived === true) return true;
  return COMPLETED_TRIP_STATUS_SET.has(status);
}

function tripNeedsDeliveryEnrichment(trip = {}) {
  if (!isHubTransferTrip(trip)) return false;
  if (trip.reconciledAt) return true;
  return resolveManifestStatus(trip) === MANIFEST_STATUS.RECONCILED;
}

async function getShipmentDocsInBatches(shipmentIds = []) {
  const uniqueIds = [...new Set(shipmentIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const masterById = new Map();
  const batchSize = 10;

  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const chunk = uniqueIds.slice(index, index + batchSize);
    const refs = chunk.map((id) => adminDb.collection("shipments").doc(id));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) {
        masterById.set(snap.id, snap.data());
      }
    });
  }

  return masterById;
}

async function enrichHubTripsWithMasterPackages(trips = []) {
  const tripsToEnrich = trips.filter(tripNeedsDeliveryEnrichment);
  if (tripsToEnrich.length === 0) return trips;

  const shipmentIds = [];
  tripsToEnrich.forEach((trip) => {
    (trip.shipments || []).forEach((row) => {
      shipmentIds.push(row.trackingShipmentId || row.id);
    });
  });

  const masterById = await getShipmentDocsInBatches(shipmentIds);

  return trips.map((trip) => {
    if (!tripNeedsDeliveryEnrichment(trip)) return trip;

    const shipments = (trip.shipments || []).map((row) => {
      const masterId = row.trackingShipmentId || row.id;
      const master = masterById.get(masterId);
      if (!master) return row;

      return {
        ...row,
        packages: getTripScopedPackages(
          row,
          { packages: master.packages },
          trip.id,
        ),
        packageBreakdown: master.packageBreakdown || null,
        masterStatus: master.status || null,
        releasedForDeliveryAt: master.releasedForDeliveryAt || null,
        availableForDelivery: master.availableForDelivery === true,
      };
    });

    return { ...trip, shipments };
  });
}

function parseLimit(searchParams, key) {
  const limitParam = searchParams.get(key) || searchParams.get("limit") || "50";
  const allowedLimits = ["all", "50", "100", "200"];

  if (!allowedLimits.includes(limitParam)) {
    throw new Error(`Invalid ${key}. Use all, 50, 100, or 200.`);
  }

  return limitParam;
}

function toIsoTimestamp(value) {
  return value?.toDate ? value.toDate().toISOString() : null;
}

function serializeTripDoc(
  doc,
  { includeShipments = false, shipments = [] } = {},
) {
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    shipments: includeShipments ? shipments : [],
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
    packageTotal: data.packageTotal || 0,
  };
}

function sortDocsByUpdatedAtDesc(docs = []) {
  return [...docs].sort((left, right) => {
    const leftMs = left.data().updatedAt?.toMillis?.() || 0;
    const rightMs = right.data().updatedAt?.toMillis?.() || 0;
    return rightMs - leftMs;
  });
}

function sliceLimitedDocs(docs = [], limit) {
  if (limit === "all") return docs;
  return docs.slice(0, Number(limit));
}

async function fetchTripShipmentSummaries(tripId) {
  const shipmentsSnapshot = await adminDb
    .collection("truck_trips")
    .doc(tripId)
    .collection("trip_shipments")
    .get();

  return shipmentsSnapshot.docs.map((subDoc) => {
    const sData = subDoc.data();
    return {
      id: subDoc.id,
      ...sData,
      createdAt: toIsoTimestamp(sData.createdAt),
    };
  });
}

async function fetchAllTripDocs() {
  const snapshot = await adminDb
    .collection("truck_trips")
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs;
}

async function fetchIndexedTripDocs(activeLimit, completedLimit) {
  const activeFetchLimit = Math.min(Number(activeLimit) + 20, 250);
  const completedFetchLimit = Math.min(Number(completedLimit) + 20, 250);
  const archivedFetchLimit = Math.min(Number(completedLimit) + 20, 250);

  const [activeSnapshot, completedSnapshot, archivedSnapshot] =
    await Promise.all([
      adminDb
        .collection("truck_trips")
        .where("status", "in", ACTIVE_TRIP_STATUSES)
        .orderBy("updatedAt", "desc")
        .limit(activeFetchLimit)
        .get(),
      adminDb
        .collection("truck_trips")
        .where("status", "in", COMPLETED_TRIP_STATUSES)
        .orderBy("updatedAt", "desc")
        .limit(completedFetchLimit)
        .get(),
      adminDb
        .collection("truck_trips")
        .where("archived", "==", true)
        .orderBy("updatedAt", "desc")
        .limit(archivedFetchLimit)
        .get(),
    ]);

  const tripDocs = new Map();
  [
    ...activeSnapshot.docs,
    ...completedSnapshot.docs,
    ...archivedSnapshot.docs,
  ].forEach((doc) => {
    tripDocs.set(doc.id, doc);
  });

  return sortDocsByUpdatedAtDesc([...tripDocs.values()]);
}

async function fetchTripDocsForBoard(activeLimit, completedLimit) {
  if (activeLimit === "all" || completedLimit === "all") {
    return fetchAllTripDocs();
  }

  try {
    return await fetchIndexedTripDocs(activeLimit, completedLimit);
  } catch (error) {
    console.warn(
      "Indexed truck_trips query failed; falling back to full scan:",
      error.message,
    );
    return fetchAllTripDocs();
  }
}

function selectLimitedTripDocs(allDocs, activeLimit, completedLimit) {
  const activeDocs = sliceLimitedDocs(
    allDocs.filter((doc) => isActiveTripDoc(doc.data())),
    activeLimit,
  );
  const completedDocs = sliceLimitedDocs(
    allDocs.filter((doc) => isCompletedTripDoc(doc.data())),
    completedLimit,
  );

  const tripDocs = new Map();
  [...activeDocs, ...completedDocs].forEach((doc) => {
    tripDocs.set(doc.id, doc);
  });

  return [...tripDocs.values()];
}

async function buildTripList(docs, { view = "board" } = {}) {
  if (view === "board") {
    return docs.map((doc) => serializeTripDoc(doc));
  }

  const trips = await Promise.all(
    docs.map(async (doc) => {
      const tripData = { id: doc.id, ...doc.data() };
      const needsShipmentContext =
        view === "full" || tripNeedsDeliveryEnrichment(tripData);

      if (!needsShipmentContext) {
        return serializeTripDoc(doc);
      }

      const shipments = await fetchTripShipmentSummaries(doc.id);
      return serializeTripDoc(doc, { includeShipments: true, shipments });
    }),
  );

  return enrichHubTripsWithMasterPackages(trips);
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
    const view = searchParams.get("view") || "board";

    const allDocs = await fetchTripDocsForBoard(activeLimit, completedLimit);
    
    // Allow both admins and managers to view board trips.
    // Client-side filters will handle warehouse/origin visibility.
    const filteredDocs = allDocs;
    
    const limitedDocs = selectLimitedTripDocs(
      filteredDocs,
      activeLimit,
      completedLimit,
    );
    const trips = await buildTripList(limitedDocs, { view });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("API Error fetching trips:", error);
    return NextResponse.json(
      { error: "Failed to fetch trips", details: error.message },
      { status: error.message?.startsWith("Invalid ") ? 400 : 500 },
    );
  }
}
