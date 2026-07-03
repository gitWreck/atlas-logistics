import { adminDb } from "@/lib/firebase-admin";

function getPackageLoadedQty(pkg) {
  const qty = Math.max(Number(pkg?.quantity) || 1, 1);
  const status = String(pkg?.status || "").toUpperCase();
  const rawLoaded = Number(pkg?.loadedQty);

  if (["LOADED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) {
    return qty;
  }
  if (status === "PARTIALLY_LOADED") {
    const loaded =
      Number.isFinite(rawLoaded) && rawLoaded >= 0 ? rawLoaded : 0;
    return Math.min(loaded, qty);
  }
  if (Number.isFinite(rawLoaded) && rawLoaded > 0) {
    return Math.min(rawLoaded, qty);
  }
  return 0;
}

function getShipmentLoadedCount(ship) {
  if (ship.packages?.length) {
    return ship.packages.reduce((acc, p) => acc + getPackageLoadedQty(p), 0);
  }
  return Number(ship.loadedCount ?? ship.totals?.loaded ?? 0);
}

export async function resolveTripDocument(tripIdOrPublicId) {
  const normalized = String(tripIdOrPublicId || "").trim();
  if (!normalized) return null;

  const directSnap = await adminDb.collection("truck_trips").doc(normalized).get();
  if (directSnap.exists) {
    return { id: directSnap.id, data: directSnap.data() || {} };
  }

  const byPublicId = await adminDb
    .collection("truck_trips")
    .where("tripId", "==", normalized)
    .limit(1)
    .get();

  if (!byPublicId.empty) {
    const docSnap = byPublicId.docs[0];
    return { id: docSnap.id, data: docSnap.data() || {} };
  }

  return null;
}

function buildDestinationsFromLockedManifest(locked = {}) {
  const groupedDestinations = {};
  let totalPackages = 0;
  const shipmentCount = Number(locked.totals?.totalShipments || 0);
  totalPackages = Number(locked.totals?.totalItems || 0);

  (locked.shipments || []).forEach((ship) => {
    const routeParts = String(ship.route || "").split("->");
    const destCode = routeParts[1]?.trim() || ship.route || "UNKNOWN";
    const itemsCount = Number(ship.loadedCount || 0);
    const descriptionBreakdown = (ship.contents || []).map((item) => ({
      desc: item.desc || "Standard Pkg",
      count: 1,
    }));

    if (!groupedDestinations[destCode]) {
      groupedDestinations[destCode] = {
        destination: ship.receiverName || destCode,
        routeCode: ship.route || destCode,
        items: [],
      };
    }

    groupedDestinations[destCode].items.push({
      shipmentId: ship.shipmentId,
      packageCount: itemsCount,
      note: (ship.contents || []).some((item) => item.isFragile) ? "Fragile" : "",
      descriptionBreakdown,
    });
  });

  return {
    groupedDestinations,
    totalPackages,
    shipmentCount,
    usedLockedSnapshot: true,
  };
}

async function buildDestinationsFromLiveTrip(tripDocId) {
  const groupedDestinations = {};
  let totalPackages = 0;
  let shipmentCount = 0;

  // Multi-trip shipments have currentTripId=null, so also match the
  // currentTripIds array and de-dupe.
  const [byTripIdSnap, byTripIdsArraySnap] = await Promise.all([
    adminDb.collection("shipments").where("currentTripId", "==", tripDocId).get(),
    adminDb
      .collection("shipments")
      .where("currentTripIds", "array-contains", tripDocId)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const shipMap = new Map();
  [...byTripIdSnap.docs, ...byTripIdsArraySnap.docs].forEach((docSnap) => {
    shipMap.set(docSnap.id, docSnap.data() || {});
  });

  shipMap.forEach((ship) => {
    const destCode = ship.destinationCode || "UNKNOWN";
    const itemsCount = getShipmentLoadedCount(ship);
    totalPackages += itemsCount;
    shipmentCount += 1;

    const descCounts = {};
    if (Array.isArray(ship.packages)) {
      ship.packages.forEach((p) => {
        const loadedQty = getPackageLoadedQty(p);
        if (loadedQty <= 0) return;
        const d = p.description ? p.description.trim() : "Standard Pkg";
        descCounts[d] = (descCounts[d] || 0) + loadedQty;
      });
    }

    const descriptionBreakdown = Object.entries(descCounts).map(([desc, count]) => ({
      desc,
      count,
    }));

    if (!groupedDestinations[destCode]) {
      groupedDestinations[destCode] = {
        destination: ship.destinationCity || destCode,
        routeCode: `${ship.originCode || "ORG"}-${destCode}`,
        items: [],
      };
    }

    groupedDestinations[destCode].items.push({
      shipmentId: ship.shipmentId,
      packageCount: itemsCount,
      note: ship.packages?.some((p) => p.isFragile) ? "Fragile" : "",
      descriptionBreakdown,
    });
  });

  return {
    groupedDestinations,
    totalPackages,
    shipmentCount,
    usedLockedSnapshot: false,
  };
}

export async function buildPrintManifestPayload(tripIdOrPublicId) {
  const trip = await resolveTripDocument(tripIdOrPublicId);
  if (!trip) {
    return { error: "Trip not found", status: 404 };
  }

  const { id: tripDocId, data: tripData } = trip;
  let manifestBuild = null;

  if (tripData.manifestId) {
    const manifestSnap = await adminDb
      .collection("manifests")
      .doc(tripData.manifestId)
      .get();
    if (manifestSnap.exists) {
      manifestBuild = buildDestinationsFromLockedManifest(manifestSnap.data() || {});
    }
  }

  if (!manifestBuild) {
    manifestBuild = await buildDestinationsFromLiveTrip(tripDocId);
  }

  const destinationArray = Object.values(manifestBuild.groupedDestinations);
  const sealedAt = tripData.manifestGeneratedAt?.toDate
    ? tripData.manifestGeneratedAt.toDate().toISOString()
    : tripData.manifestGeneratedAt || new Date().toISOString();

  return {
    tripId: tripDocId,
    tripNumber: tripData.tripId || "T-PENDING",
    driverName: tripData.driverName || "Unassigned",
    truckPlate: tripData.truckPlateNumber || tripData.plateNumber || "—",
    origin: tripData.origin || "Warehouse",
    route: tripData.route || "Direct",
    sealedAt,
    version:
      tripData.manifestVersion ||
      (tripData.manifestLocked ? "v1.0-LOCKED" : "DRAFT-PREVIEW"),
    manifestHash: tripData.manifestHash || "DRAFT-NO-HASH-GENERATED",
    verifyUrl: `https://atlastransport.ph/verify/${tripDocId}`,
    stamps: tripData.manifestLocked
      ? ["LOCKED", "OFFICIAL_RECORD"]
      : ["DRAFT", "UNVERIFIED"],
    totals: {
      shipments: manifestBuild.shipmentCount,
      packages: manifestBuild.totalPackages,
      destinations: destinationArray.length,
    },
    destinations: destinationArray,
    lockedSnapshot: manifestBuild.usedLockedSnapshot,
  };
}

function formatTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function buildPrintAmendmentPayload({
  amendmentId = null,
  tripIdOrPublicId = null,
}) {
  let resolvedAmendmentId = amendmentId;

  if (!resolvedAmendmentId && tripIdOrPublicId) {
    const trip = await resolveTripDocument(tripIdOrPublicId);
    if (!trip) {
      return { error: "Trip not found", status: 404 };
    }
    resolvedAmendmentId = trip.data.latestAmendmentId || null;

    if (!resolvedAmendmentId) {
      const amendmentsSnap = await adminDb
        .collection("truck_trips")
        .doc(trip.id)
        .collection("manifest_amendments")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (!amendmentsSnap.empty) {
        resolvedAmendmentId = amendmentsSnap.docs[0].id;
      }
    }
  }

  if (!resolvedAmendmentId) {
    return { error: "No manifest amendment found for this trip.", status: 404 };
  }

  const amendmentSnap = await adminDb
    .collection("manifest_amendments")
    .doc(resolvedAmendmentId)
    .get();

  if (!amendmentSnap.exists) {
    return { error: "Manifest amendment not found.", status: 404 };
  }

  const data = amendmentSnap.data() || {};
  return {
    ...data,
    sealedAt:
      data.meta?.sealedAtMs
        ? new Date(data.meta.sealedAtMs).toISOString()
        : formatTimestamp(data.createdAt),
    adminName: data.meta?.sealedByName || null,
    verifyUrl:
      data.verifyUrl ||
      `https://atlastransport.ph/verify/amendment/${resolvedAmendmentId}`,
  };
}
