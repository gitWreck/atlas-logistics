import { adminDb } from "@/lib/firebase-admin";
import { evaluateTripLifecycleAfterReconciliation } from "@/app/utility/tripLifecycle";
import {
  extractMissingPackagesFromRow,
  flattenMissingPackages,
  resolveMissingPackagesForRow,
} from "@/app/utility/reconciliationPieces";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const LOADED_ON_TRUCK_PIECE_STATUSES = new Set([
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
  "OUT_FOR_DELIVERY",
]);

const LINEHAUL_NOT_HUB_UNLOADED_STATUSES = new Set([
  "IN_TRANSIT",
  "LOADED_TO_TRIP",
  "LOADED",
  "PARTIALLY_LOADED",
]);

const RECEIVED_AT_HUB_PIECE_STATUSES = new Set([
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "RELEASED_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
]);

function pieceQuantity(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function getPackageIdentity(pkg = {}) {
  return (
    pkg.packageId ||
    pkg.trackingNumber ||
    pkg.pieceId ||
    pkg.barcode ||
    null
  );
}

function packageWasOnTrip(pkg = {}, tripId = "", tripBarcodeSet = new Set()) {
  const packageTripId = String(pkg.currentTripId || pkg.loadedOnTrip || "").trim();
  const hubReceivedOnTrip = String(pkg.hubReceivedOnTrip || "").trim();
  if (packageTripId === tripId || hubReceivedOnTrip === tripId) return true;

  const packageId = getPackageIdentity(pkg);
  if (!packageId || !tripBarcodeSet.has(String(packageId))) return false;

  const status = String(pkg.status || "").toUpperCase();
  if (RECEIVED_AT_HUB_PIECE_STATUSES.has(status) || pkg.hubReceivedAt) {
    return true;
  }
  if (LOADED_ON_TRUCK_PIECE_STATUSES.has(status)) return true;

  const loadedQty = toNumber(pkg.loadedQty, 0);
  const receivedQty = toNumber(pkg.receivedQty, 0);
  return loadedQty > 0 || receivedQty > 0;
}

function getTripPackages(shipment = {}, tripShipment = {}, tripId = "") {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const tripBarcodeSet = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );

  return packages.filter((pkg) => {
    if (packageWasOnTrip(pkg, tripId, tripBarcodeSet)) return true;
    return String(pkg.hubReceivedOnTrip || "").trim() === tripId;
  });
}

function classifyTripPiece(pkg = {}, tripId = "") {
  const status = String(pkg.status || "").toUpperCase();
  const qty = pieceQuantity(pkg);
  const onTrip =
    String(pkg.currentTripId || pkg.loadedOnTrip || "").trim() === tripId ||
    String(pkg.hubReceivedOnTrip || "").trim() === tripId;

  if (status === "DELIVERED" || status === "COMPLETED") {
    return { bucket: "received", qty };
  }

  if (status === "MISSING" || toNumber(pkg.missingQty, 0) > 0) {
    return { bucket: "missing", qty };
  }

  const loadedQty = toNumber(pkg.loadedQty, 0);
  const receivedQty = toNumber(pkg.receivedQty, 0);

  // Trust explicit linehaul/on-truck status over stale hubReceivedAt from prior scans.
  if (
    LINEHAUL_NOT_HUB_UNLOADED_STATUSES.has(status) &&
    loadedQty > 0 &&
    receivedQty === 0
  ) {
    return { bucket: "on_truck", qty };
  }

  // Still on truck when linehaul-loaded but not hub-unloaded (stale hubReceivedAt).
  if (
    LOADED_ON_TRUCK_PIECE_STATUSES.has(status) &&
    loadedQty > 0 &&
    receivedQty === 0
  ) {
    return { bucket: "on_truck", qty };
  }

  if (
    RECEIVED_AT_HUB_PIECE_STATUSES.has(status) ||
    (pkg.hubReceivedAt && !LINEHAUL_NOT_HUB_UNLOADED_STATUSES.has(status)) ||
    (toNumber(pkg.receivedQty, 0) > 0 && !LOADED_ON_TRUCK_PIECE_STATUSES.has(status))
  ) {
    return { bucket: "received", qty };
  }

  if (LOADED_ON_TRUCK_PIECE_STATUSES.has(status) || onTrip) {
    return { bucket: "on_truck", qty };
  }

  return { bucket: "unknown", qty };
}

function summarizeTripPieces(tripPackages = [], tripId = "") {
  const pieces = [];
  let stillOnTruck = 0;
  let unloaded = 0;
  let missing = 0;

  tripPackages.forEach((pkg) => {
    const pieceId = getPackageIdentity(pkg) || "Unknown label";
    const { bucket, qty } = classifyTripPiece(pkg, tripId);

    if (bucket === "missing") missing += qty;
    else if (bucket === "received") unloaded += qty;
    else if (bucket === "on_truck") stillOnTruck += qty;

    pieces.push({
      pieceId,
      quantity: qty,
      state: bucket === "received" ? "received" : bucket,
      packageStatus: String(pkg.status || "").toUpperCase() || null,
      loadedBy: pkg.loadedBy || null,
      loadedAt: pkg.loadedAt || null,
      loadedAtLocation: pkg.loadedAtLocation || null,
      receivedBy: pkg.receivedBy || pkg.updatedBy || null,
      receivedAt: pkg.hubReceivedAt || pkg.updatedAt || null,
    });
  });

  const loadedIntoTruck = stillOnTruck + unloaded + missing;

  return {
    pieces,
    stillOnTruck,
    unloaded,
    missing,
    loadedIntoTruck,
  };
}

function resolveExpectedPieceCount(
  item = {},
  tripShipment = {},
  shipment = {},
  tripId = "",
  pieceSummary = null,
) {
  const summaryTotal = toNumber(pieceSummary?.loadedIntoTruck, 0);
  if (summaryTotal > 0) return summaryTotal;

  const tripLoaded = toNumber(tripShipment.loadedCount, 0);
  const tripReceived = toNumber(
    tripShipment.receivedCount ?? tripShipment.deliveredCount,
    0,
  );
  const tripMissing = toNumber(tripShipment.missingCount, 0);
  const tripDerivedTotal = tripLoaded + tripReceived + tripMissing;
  if (tripDerivedTotal > 0) return tripDerivedTotal;

  const tripTotal = toNumber(tripShipment.totalItems, 0);
  if (tripTotal > 0) return tripTotal;

  const manifestLoaded = toNumber(item.loadedCount, -1);
  if (manifestLoaded > 0) return manifestLoaded;

  const tripBarcodeCount = Array.isArray(tripShipment.packageBarcodes)
    ? tripShipment.packageBarcodes.filter(Boolean).length
    : 0;
  if (tripBarcodeCount > 0) return tripBarcodeCount;

  const tripPackages = getTripPackages(shipment, tripShipment, tripId);
  if (tripPackages.length > 0) {
    return tripPackages.reduce((sum, pkg) => sum + pieceQuantity(pkg), 0);
  }

  const manifestTotal = toNumber(item.totalCount, 0);
  if (manifestTotal > 0) return manifestTotal;

  return toNumber(
    shipment.totals?.totalContentQty ?? shipment.totals?.totalItems,
    0,
  );
}

function formatWarehouseLabel(value, fallback) {
  const label = String(value || "").trim();
  if (!label) return fallback;
  if (/warehouse|hub/i.test(label)) return label;
  return `${label} Hub`;
}

function buildReconciliationContext(trip = {}, manifest = {}, shipments = []) {
  const origin =
    trip.origin ||
    trip.originName ||
    manifest?.trip?.origin ||
    "Origin warehouse";
  const destination =
    trip.destination ||
    trip.destinationName ||
    manifest?.trip?.destination ||
    "Destination hub";

  const allPieces = shipments.flatMap((row) => row.pieces || []);
  const loadedPiece = allPieces.find((piece) => piece.loadedBy);
  const unloadedPiece = allPieces.find((piece) => piece.receivedBy);

  return {
    originWarehouse: formatWarehouseLabel(origin, "Origin warehouse"),
    destinationWarehouse: formatWarehouseLabel(destination, "Destination hub"),
    loadedScanBy:
      loadedPiece?.loadedBy ||
      trip.manifestGeneratedBy ||
      manifest?.meta?.generatedByName ||
      null,
    unloadedScanBy:
      unloadedPiece?.receivedBy || trip.receivingStartedByName || null,
  };
}

function findUnlinkedVariancePackages(
  shipment = {},
  tripShipment = {},
  tripId = "",
  pieces = [],
  loadedIntoTruck = 0,
  unloadedCount = 0,
) {
  const gap = loadedIntoTruck - unloadedCount;
  if (gap <= 0) return [];

  const scopedIds = new Set(
    pieces.map((piece) => String(piece.pieceId || "")).filter(Boolean),
  );
  const tripBarcodes = new Set(
    (tripShipment.packageBarcodes || []).filter(Boolean).map(String),
  );
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];

  return packages
    .filter((pkg) => {
      const pieceId = getPackageIdentity(pkg);
      if (!pieceId || scopedIds.has(String(pieceId))) return false;

      const hubReceivedOnTrip = String(pkg.hubReceivedOnTrip || "").trim();
      const loadedOnTrip = String(pkg.loadedOnTrip || "").trim();
      if (hubReceivedOnTrip === tripId || loadedOnTrip === tripId) return true;

      if (pkg.hubReceivedAt && !tripBarcodes.has(String(pieceId))) return true;

      return false;
    })
    .map((pkg) => ({
      pieceId: getPackageIdentity(pkg),
      quantity: pieceQuantity(pkg),
      state: "variance",
      packageStatus: String(pkg.status || "").toUpperCase() || null,
      loadedBy: pkg.loadedBy || null,
      loadedAt: pkg.loadedAt || null,
      loadedAtLocation: pkg.loadedAtLocation || null,
      receivedBy: pkg.receivedBy || pkg.updatedBy || null,
      receivedAt: pkg.hubReceivedAt || pkg.updatedAt || null,
    }));
}

async function buildReconciliationRow(tripRef, tripId, item, shipmentDocId) {
  if (!shipmentDocId) return null;

  const [tripShipmentSnap, shipmentSnap] = await Promise.all([
    tripRef.collection("trip_shipments").doc(shipmentDocId).get(),
    adminDb.collection("shipments").doc(shipmentDocId).get(),
  ]);

  const tripShipment = tripShipmentSnap.data() || {};
  const shipment = shipmentSnap.data() || {};
  const tripPackages = getTripPackages(shipment, tripShipment, tripId);
  const pieceSummary = summarizeTripPieces(tripPackages, tripId);

  const tripLoaded = toNumber(tripShipment.loadedCount, 0);
  const tripReceived = toNumber(
    tripShipment.receivedCount ?? tripShipment.deliveredCount,
    0,
  );
  const tripMissing = toNumber(tripShipment.missingCount, 0);
  const manifestLoadedCount = toNumber(item.loadedCount, 0);

  let loadedIntoTruck = Math.max(
    pieceSummary.loadedIntoTruck,
    tripLoaded + tripReceived + tripMissing,
    manifestLoadedCount,
  );
  let unloadedCount = pieceSummary.unloaded;
  if (pieceSummary.stillOnTruck === 0 && pieceSummary.missing === 0) {
    unloadedCount = Math.max(unloadedCount, tripReceived);
  }
  let remainingLoaded = Math.max(pieceSummary.stillOnTruck, tripLoaded);
  let missingPieces = Math.max(pieceSummary.missing, tripMissing);

  const onTrip = loadedIntoTruck > 0;
  const pieceCountVariance = loadedIntoTruck > unloadedCount;
  const isMissing = onTrip && (remainingLoaded > 0 || pieceCountVariance);
  const isReadyForRelease =
    onTrip && !isMissing && unloadedCount > 0 && unloadedCount >= loadedIntoTruck;

  const variancePieces =
    pieceCountVariance && remainingLoaded === 0
      ? findUnlinkedVariancePackages(
          shipment,
          tripShipment,
          tripId,
          pieceSummary.pieces,
          loadedIntoTruck,
          unloadedCount,
        )
      : [];
  const reconciliationPieces =
    variancePieces.length > 0
      ? [...pieceSummary.pieces, ...variancePieces]
      : pieceSummary.pieces;

  const piecesForMissingExtraction = [
    ...pieceSummary.pieces,
    ...variancePieces.map((piece) => ({ ...piece, state: "on_truck" })),
  ];

  const rowDraft = {
    id: shipmentDocId,
    shipmentId: shipment.shipmentId || item?.shipmentId || shipmentDocId,
    recipientName:
      shipment.recipient?.name || item?.receiverName || "Unknown recipient",
    destination:
      shipment.recipient?.city ||
      shipment.destination ||
      shipment.destinationCode ||
      "Unknown destination",
    expectedCount: loadedIntoTruck,
    unloadedCount,
    remainingLoaded,
    missingPieces,
    onTrip,
    missing: isMissing,
    readyForRelease: isReadyForRelease,
    currentTripId: shipment.currentTripId || tripId,
    status: shipment.status || tripShipment.status || null,
    pieces: reconciliationPieces,
    tripPackages,
    labelSummary: {
      total: loadedIntoTruck,
      received: unloadedCount,
      ready: isReadyForRelease,
    },
  };

  const missingPackages =
    isMissing || loadedIntoTruck > unloadedCount || remainingLoaded > 0
      ? resolveMissingPackagesForRow(
          { ...rowDraft, pieces: piecesForMissingExtraction },
          tripPackages,
        )
      : [];

  return {
    ...rowDraft,
    missingPackages,
  };
}

async function reconcileFromLockedManifest(tripRef, tripId, manifestId) {
  const manifestSnap = await adminDb.collection("manifests").doc(manifestId).get();

  if (!manifestSnap.exists) {
    return { error: "Manifest not found", status: 404 };
  }

  const manifest = manifestSnap.data() || {};
  const manifestShipments = Array.isArray(manifest.shipments)
    ? manifest.shipments
    : [];

  const rows = await Promise.all(
    manifestShipments.map((item) => {
      const shipmentDocId =
        item.trackingShipmentId || item.shipmentId || item.id || null;
      return buildReconciliationRow(tripRef, tripId, item, shipmentDocId);
    }),
  );

  return {
    manifestId,
    manifest,
    source: "locked_manifest",
    shipments: rows.filter(Boolean),
  };
}

async function reconcileFromTripShipments(tripRef, tripId) {
  const tripShipmentSnap = await tripRef.collection("trip_shipments").get();

  if (tripShipmentSnap.empty) {
    return {
      error:
        "Trip has no shipments to reconcile. Add shipments to the trip manifest first.",
      status: 400,
    };
  }

  const rows = await Promise.all(
    tripShipmentSnap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const shipmentDocId =
        data.trackingShipmentId || docSnap.id || data.shipmentId || null;
      return buildReconciliationRow(tripRef, tripId, data, shipmentDocId);
    }),
  );

  return {
    manifestId: null,
    manifest: null,
    source: "trip_shipments",
    shipments: rows.filter(Boolean),
  };
}

/**
 * Load trip + manifest rows and evaluate lifecycle (Step 1.1).
 */
export async function runTripHandoffReconciliation(tripId) {
  const tripRef = adminDb.collection("truck_trips").doc(tripId);
  const tripSnap = await tripRef.get();

  if (!tripSnap.exists) {
    return { error: "Trip not found", status: 404 };
  }

  const trip = { id: tripSnap.id, ...tripSnap.data() };
  const manifestId = trip.manifestId;

  let result = manifestId
    ? await reconcileFromLockedManifest(tripRef, tripId, manifestId)
    : await reconcileFromTripShipments(tripRef, tripId);

  if (result.error && manifestId) {
    const fallback = await reconcileFromTripShipments(tripRef, tripId);
    if (!fallback.error) result = fallback;
  }

  if (result.error) {
    return { error: result.error, status: result.status || 400 };
  }

  const allRows = result.shipments || [];
  const shipments = allRows.filter((item) => item.onTrip);
  const assignedNotLoaded = allRows.filter((item) => !item.onTrip);
  const missingShipments = shipments.filter(
    (item) =>
      item.missing ||
      item.missingPackages?.length > 0 ||
      item.expectedCount > item.unloadedCount ||
      item.remainingLoaded > 0,
  );
  const missingPackages = flattenMissingPackages(missingShipments);
  const unloadedShipments = shipments.filter(
    (item) => !missingShipments.some((missingRow) => missingRow.id === item.id),
  );
  const lifecycleEval = evaluateTripLifecycleAfterReconciliation(trip, shipments);
  const context = buildReconciliationContext(
    trip,
    result.manifest,
    shipments,
  );

  return {
    tripId,
    trip,
    manifestId: result.manifestId,
    source: result.source,
    tripStatus: trip.status || null,
    ready: lifecycleEval.reconciliation.ready,
    context,
    totals: {
      manifestShipments: lifecycleEval.reconciliation.manifestShipments,
      unloadedShipments: lifecycleEval.reconciliation.unloadedShipments,
      missingShipments: lifecycleEval.reconciliation.missingShipments,
      manifestPieces: lifecycleEval.reconciliation.manifestPieces,
      unloadedPieces: lifecycleEval.reconciliation.unloadedPieces,
      onTruckPieces: lifecycleEval.reconciliation.onTruckPieces,
      missingPieces: lifecycleEval.reconciliation.missingPieces,
      missingPackages: missingPackages.length,
      missingPackageIds: missingPackages.map((entry) => entry.packageId),
    },
    lifecycle: {
      recommendedNextStatus: lifecycleEval.recommendedNextStatus,
      canPromoteToArrived: lifecycleEval.arrived.promote,
      promotionReason: lifecycleEval.arrived.reason,
      promotionMessage: lifecycleEval.arrived.message || null,
      canReleaseForDelivery: lifecycleEval.release.eligible,
      releaseBlockReason: lifecycleEval.release.reason || null,
    },
    lifecycleEval,
    shipments,
    unloadedShipments,
    missingShipments,
    missingPackages,
    assignedNotLoaded,
  };
}

export function formatHandoffReconciliationResponse(payload) {
  if (payload.error) return payload;

  return {
    tripId: payload.tripId,
    manifestId: payload.manifestId,
    source: payload.source,
    tripStatus: payload.tripStatus,
    ready: payload.ready,
    context: payload.context || null,
    totals: payload.totals,
    lifecycle: payload.lifecycle,
    shipments: payload.shipments,
    unloadedShipments: payload.unloadedShipments,
    missingShipments: payload.missingShipments,
    missingPackages: payload.missingPackages || [],
    assignedNotLoaded: payload.assignedNotLoaded || [],
    promoted: payload.promoted || false,
    promotionSkippedReason: payload.promotionSkippedReason || null,
  };
}
