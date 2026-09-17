import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import {
  MANIFEST_STATUS,
  isHubTransferTrip,
  resolveManifestStatus,
} from "@/app/utility/manifestStatus";
import { getTripScopedPackages } from "@/app/utility/tripScopedPackages";
import { managerCanAccessRecord } from "@/lib/managerAccess";

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

  const batchSize = 30;
  const chunks = [];
  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    chunks.push(uniqueIds.slice(index, index + batchSize));
  }

  // Run all getAll batches concurrently instead of sequentially.
  const snapsPerChunk = await Promise.all(
    chunks.map((chunk) =>
      adminDb.getAll(
        ...chunk.map((id) => adminDb.collection("shipments").doc(id)),
      ),
    ),
  );

  const masterById = new Map();
  snapsPerChunk.forEach((snaps) => {
    snaps.forEach((snap) => {
      if (snap.exists) {
        masterById.set(snap.id, snap.data());
      }
    });
  });

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

    const shipments = (trip.shipments || []).flatMap((row) => {
      const masterId = row.trackingShipmentId || row.id;
      const master = masterById.get(masterId);
      if (!master) return [row];

      // `trip_shipments` is an operational manifest ledger. A shipment can be
      // moved to a later trip after the ledger row was written. When its live
      // master record has a definite assignment elsewhere, do not expose that
      // stale row as part of this trip's active shipment or invoice total.
      // A record with no current assignment is retained for historical views;
      // an explicit multi-trip assignment is retained for each listed trip.
      const assignedTripIds = [
        master.currentTripId,
        ...(Array.isArray(master.currentTripIds) ? master.currentTripIds : []),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (assignedTripIds.length > 0 && !assignedTripIds.includes(String(trip.id))) {
        return [];
      }

      return [{
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
      }];
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
  const trips = await Promise.all(
    docs.map(async (doc) => {
      const tripData = { id: doc.id, ...doc.data() };

      // Board rows only need piece-level shipment detail for ACTIVE reconciled
      // hub trips (in-progress "X/Y delivered" bars). Completed/cancelled/
      // archived trips render from their sealed trip-level counters, so we skip
      // their expensive trip_shipments subcollection reads. The `full` view
      // (drawer/exports) always enriches.
      const needsShipmentContext =
        view === "full" ||
        (isActiveTripDoc(tripData) && tripNeedsDeliveryEnrichment(tripData));

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
    const startedAt = Date.now();
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const activeLimit = parseLimit(searchParams, "activeLimit");
    const completedLimit = parseLimit(searchParams, "completedLimit");
    const view = searchParams.get("view") || "board";

    // Overlap the role-check read with the (slower) trip docs query.
    // Trip data is discarded if the role check fails, so nothing leaks.
    const docsStartedAt = Date.now();
    const [userDoc, allDocs] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      fetchTripDocsForBoard(activeLimit, completedLimit),
    ]);
    const docsMs = Date.now() - docsStartedAt;

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

    const authorizedDocs = allDocs.filter((doc) =>
      managerCanAccessRecord(userData, doc.data()),
    );
    const limitedDocs = selectLimitedTripDocs(
      authorizedDocs,
      activeLimit,
      completedLimit,
    );

    const enrichStartedAt = Date.now();
    const trips = await buildTripList(limitedDocs, { view });
    const enrichMs = Date.now() - enrichStartedAt;

    const enrichedCount = trips.filter(
      (trip) => Array.isArray(trip.shipments) && trip.shipments.length > 0,
    ).length;
    console.log(
      `[api/trips] view=${view} docs=${docsMs}ms enrich=${enrichMs}ms total=${
        Date.now() - startedAt
      }ms trips=${trips.length} enriched=${enrichedCount}`,
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
