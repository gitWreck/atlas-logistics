import { adminDb } from "@/lib/firebase-admin";
import { resolveTripDocument } from "@/lib/printManifestData";
import { buildPrintManifestPayload } from "@/lib/printManifestData";
import {
  buildDeliveryDestinationsFromShipments,
  buildDeliveryManifestShipments,
} from "@/lib/deliveryManifestLedger";
import { loadTripManifestShipments } from "@/lib/tripManifestShipments";

const DELIVERY_MANIFEST_VERSION = "DELIVERY-v1.0";

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

function formatDisplayDate(value) {
  const iso = formatTimestamp(value);
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function resolveUserName(uid) {
  if (!uid) return null;
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const user = snap.data() || {};
  return user.fullName || user.name || user.displayName || null;
}

async function loadDeliveryManifest(tripData, tripDocId) {
  if (tripData.deliveryManifestId) {
    const snap = await adminDb
      .collection("manifests")
      .doc(tripData.deliveryManifestId)
      .get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() };
    }
  }

  const byTrip = await adminDb
    .collection("manifests")
    .where("tripId", "==", tripDocId)
    .where("type", "==", "DELIVERY")
    .limit(1)
    .get();

  if (!byTrip.empty) {
    const doc = byTrip.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  return null;
}

async function loadShippingManifest(tripData) {
  if (!tripData.manifestId) return null;
  const snap = await adminDb.collection("manifests").doc(tripData.manifestId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

function buildShippingManifestCard(tripData, shippingManifest, printPayload) {
  const version =
    tripData.manifestVersion ||
    shippingManifest?.version ||
    (tripData.manifestLocked ? "v1.0-LOCKED" : "DRAFT");

  return {
    type: "SHIPPING",
    title: "Shipping Manifest",
    description:
      "This manifest contains the packages loaded in the truck at Divisoria and dispatched to Odiongan.",
    status: shippingManifest?.status || (tripData.manifestLocked ? "LOCKED" : "DRAFT"),
    version: version.replace("-LOCKED", ""),
    createdAt: formatDisplayDate(
      tripData.manifestGeneratedAt || shippingManifest?.createdAt,
    ),
    createdByName:
      shippingManifest?.meta?.generatedByName ||
      tripData.manifestGeneratedByName ||
      null,
    createdByRole: "Hub Transfer",
    summary: {
      origin: tripData.origin || shippingManifest?.trip?.origin || "Divisoria Hub",
      destination:
        tripData.destination || shippingManifest?.trip?.destination || "Odiongan Hub",
      totalShipments:
        shippingManifest?.totals?.totalShipments ||
        printPayload?.totals?.shipments ||
        0,
      totalPackagesLoaded:
        shippingManifest?.totals?.totalItems || printPayload?.totals?.packages || 0,
      route: tripData.route || shippingManifest?.trip?.route || "—",
    },
    manifestId: tripData.manifestId || shippingManifest?.manifestId || null,
    hash: tripData.manifestHash || shippingManifest?.hash || null,
    verifyUrl:
      printPayload?.verifyUrl || `https://atlastransport.ph/verify/${tripData.id}`,
    printPath: `/components/print/manifest?tripId=${tripData.id}`,
    available: Boolean(tripData.manifestLocked || shippingManifest),
  };
}

function buildDeliveryManifestCard(tripData, deliveryManifest, completedByName) {
  const totals = deliveryManifest?.totals || {};
  const received = Number(totals.totalPackagesReceived || 0);
  const delivered = Number(totals.totalDelivered || 0);
  const podCaptured = Number(totals.podCaptured || 0);
  const podPercent =
    delivered > 0 ? `${((podCaptured / delivered) * 100).toFixed(1)}%` : "0%";

  return {
    type: "DELIVERY",
    title: "Delivery Manifest",
    description:
      "This manifest contains the summary of received, delivered, and returned packages in Odiongan.",
    status: deliveryManifest?.status || "COMPLETED",
    version: deliveryManifest?.version || DELIVERY_MANIFEST_VERSION,
    completedAt: formatDisplayDate(
      tripData.deliveryManifestCompletedAt ||
        deliveryManifest?.meta?.completedAtMs ||
        deliveryManifest?.createdAt ||
        tripData.completedAt,
    ),
    completedByName:
      deliveryManifest?.meta?.completedByName || completedByName || tripData.updatedBy || null,
    completedByRole: "Checker",
    summary: {
      totalPackagesReceived: received,
      totalDelivered: delivered,
      totalFailedDelivery: Number(totals.totalFailedDelivery || 0),
      totalReturnedToWarehouse: Number(totals.totalReturnedToWarehouse || 0),
      podCaptured,
      podPercent,
      deliveryHub:
        deliveryManifest?.trip?.deliveryHub || tripData.destination || "Odiongan Hub",
    },
    shippingManifestReference:
      deliveryManifest?.shippingManifestReference || tripData.manifestId || null,
    manifestId: deliveryManifest?.manifestId || tripData.deliveryManifestId || null,
    hash: tripData.deliveryManifestHash || deliveryManifest?.hash || null,
    verifyUrl:
      deliveryManifest?.verifyUrl ||
      `https://atlastransport.ph/verify/${tripData.id}-DELIVERY`,
    printPath: `/components/print/delivery-manifest?tripId=${tripData.id}`,
    available: Boolean(deliveryManifest || tripData.deliveryManifestId),
  };
}

const MILESTONE_DEFS = [
  {
    key: "DIVISORIA_RECEIVED",
    label: "Divisoria Received",
    tripFields: ["actualLoadingStart", "plannedLoadingStart", "createdAt"],
    auditActions: ["RECEIVED_AT_DIVISORIA", "RECEIVE_SCAN"],
  },
  {
    key: "LOADED_TO_TRUCK",
    label: "Loaded to Main Truck",
    tripFields: ["manifestGeneratedAt", "actualLoadingEnd"],
    auditActions: ["LOCK_MANIFEST", "LOAD_TO_TRIP"],
  },
  {
    key: "IN_TRANSIT",
    label: "In Transit",
    tripFields: ["dispatchedAt", "actualDeparture"],
    auditActions: ["DISPATCH_TRIP", "START_TRIP"],
  },
  {
    key: "ARRIVED_ODIONGAN",
    label: "Arrived at Odiongan",
    tripFields: ["arrivedAt"],
    auditActions: ["ARRIVED", "RECEIVE_AT_ODIONGAN"],
  },
  {
    key: "RELEASED_TO_CHECKER",
    label: "Released to Checker",
    tripFields: ["reconciledAt", "receivingCompletedAt"],
    auditActions: [
      "RELEASE_FOR_DELIVERY",
      "RELEASED_FOR_DELIVERY_OPERATIONS",
      "RELEASED_TO_CHECKER",
    ],
  },
  {
    key: "LOADED_TO_DELIVERY_VEHICLE",
    label: "Loaded to Delivery Vehicle",
    tripFields: [],
    auditActions: ["LOADED_TO_DELIVERY_VEHICLE", "LOAD_PACKAGES_TO_DELIVERY_MANIFEST"],
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    tripFields: [],
    auditActions: ["OUT_FOR_DELIVERY"],
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    tripFields: ["completedAt", "autoCompletedAt"],
    auditActions: ["COMPLETE_TRIP", "AUTO_COMPLETE_TRIP", "DELIVERED"],
  },
];

function pickTripMilestone(tripData, def) {
  for (const field of def.tripFields) {
    const ts = formatTimestamp(tripData[field]);
    if (ts) {
      return {
        key: def.key,
        label: def.label,
        timestamp: ts,
        displayAt: formatDisplayDate(tripData[field]),
        actorName: tripData.updatedBy || null,
        source: "trip",
      };
    }
  }
  return null;
}

function pickAuditMilestone(entries, def) {
  const match = entries.find((entry) => {
    const action = String(entry.action || "").toUpperCase();
    return def.auditActions.some((needle) => action.includes(needle));
  });
  if (!match) return null;
  return {
    key: def.key,
    label: def.label,
    timestamp: formatTimestamp(match.timestamp) || null,
    displayAt: formatDisplayDate(match.timestamp),
    actorName: match.user || match.actorName || null,
    source: "audit",
  };
}

function buildCustodySummary(tripData, auditEntries = []) {
  const milestones = MILESTONE_DEFS.map((def) => {
    return pickTripMilestone(tripData, def) || pickAuditMilestone(auditEntries, def);
  }).filter(Boolean);

  return milestones;
}

async function loadAuditEntriesForCustody(tripDocId, tripCode) {
  const queries = [
    adminDb
      .collection("audit_logs")
      .where("targetId", "==", tripDocId)
      .orderBy("timestamp", "asc")
      .limit(100)
      .get()
      .catch(() => ({ docs: [] })),
  ];

  if (tripCode && tripCode !== tripDocId) {
    queries.push(
      adminDb
        .collection("audit_logs")
        .where("tripId", "==", tripCode)
        .orderBy("timestamp", "asc")
        .limit(100)
        .get()
        .catch(() => ({ docs: [] })),
    );
  }

  const results = await Promise.all(queries);
  const entries = [];

  results.forEach((snap) => {
    snap.docs.forEach((doc) => {
      const data = doc.data() || {};
      entries.push({
        action: data.action || data.actionType,
        user: data.user || data.actorName,
        actorName: data.actorName,
        timestamp: data.timestamp || data.createdAt,
      });
    });
  });

  return entries;
}

export async function buildTripManifestsPayload(tripIdOrPublicId) {
  const trip = await resolveTripDocument(tripIdOrPublicId);
  if (!trip) {
    return { error: "Trip not found", status: 404 };
  }

  const { id: tripDocId, data: tripData } = trip;
  tripData.id = tripDocId;

  const [shippingManifest, deliveryManifest, printPayload, completedByName] =
    await Promise.all([
      loadShippingManifest(tripData),
      loadDeliveryManifest(tripData, tripDocId),
      buildPrintManifestPayload(tripDocId).catch(() => null),
      resolveUserName(
        tripData.deliveryManifestCompletedBy ||
          tripData.lastUpdatedBy ||
          tripData.autoCompletedBy,
      ),
    ]);

  const auditEntries = await loadAuditEntriesForCustody(
    tripDocId,
    tripData.tripId,
  );

  const shippingCard = buildShippingManifestCard(
    tripData,
    shippingManifest,
    printPayload && !printPayload.error ? printPayload : null,
  );
  const deliveryCard = buildDeliveryManifestCard(
    tripData,
    deliveryManifest,
    completedByName,
  );

  const manifestCount =
    (shippingCard.available ? 1 : 0) + (deliveryCard.available ? 1 : 0);

  return {
    tripId: tripDocId,
    tripCode: tripData.tripId || tripDocId,
    status: tripData.status,
    completed: ["COMPLETED", "DELIVERED"].includes(
      String(tripData.status || "").toUpperCase(),
    ),
    completion: {
      completedAt: formatDisplayDate(tripData.completedAt),
      completedByName: completedByName || tripData.updatedBy || null,
      location: tripData.destination || "Odiongan Hub",
      message:
        "All deliveries are completed and finalized. Both manifests are available for audit and printing.",
    },
    manifests: {
      shipping: shippingCard,
      delivery: deliveryCard,
      count: manifestCount,
    },
    custodySummary: buildCustodySummary(tripData, auditEntries),
    exportBundle: {
      shipping: shippingCard,
      delivery: deliveryCard,
      custodySummary: buildCustodySummary(tripData, auditEntries),
    },
  };
}

export async function buildPrintDeliveryManifestPayload(tripIdOrPublicId) {
  const trip = await resolveTripDocument(tripIdOrPublicId);
  if (!trip) {
    return { error: "Trip not found", status: 404 };
  }

  const { id: tripDocId, data: tripData } = trip;
  const payload = await buildTripManifestsPayload(tripDocId);
  if (payload.error) return payload;

  const delivery = payload.manifests.delivery;
  if (!delivery.available) {
    return {
      error: "Delivery manifest not available for this trip.",
      status: 404,
    };
  }

  const shipments = await loadTripManifestShipments(adminDb, tripDocId);

  let deliveryManifestDoc = null;
  if (tripData.deliveryManifestId) {
    const manifestSnap = await adminDb
      .collection("manifests")
      .doc(tripData.deliveryManifestId)
      .get();
    if (manifestSnap.exists) {
      deliveryManifestDoc = manifestSnap.data() || {};
    }
  }

  const destinationsFromSealed =
    Array.isArray(deliveryManifestDoc?.shipments) &&
    deliveryManifestDoc.shipments.length > 0
      ? buildDeliveryDestinationsFromShipments(
          deliveryManifestDoc.shipments.map((row) => ({
            id: row.trackingShipmentId,
            shipmentId: row.shipmentId,
            originCode: row.route?.split("->")[0]?.trim(),
            destinationCode: row.route?.split("->")[1]?.trim(),
            destinationCity: row.destinationLabel || row.route?.split("->")[1]?.trim(),
            recipient: { name: row.receiverName },
            packages: row.contents?.map((piece) => ({
              packageId: piece.packageId,
              description: piece.description,
              status: piece.status,
              quantity: piece.quantity,
            })),
          })),
        )
      : [];

  const destinations =
    destinationsFromSealed.length > 0
      ? destinationsFromSealed
      : buildDeliveryDestinationsFromShipments(shipments);

  const hubDestination =
    tripData.destination ||
    deliveryManifestDoc?.trip?.destination ||
    payload.manifests.shipping.summary.destination ||
    null;

  if (hubDestination && destinations.length > 0) {
    destinations.forEach((group) => {
      const routeDest = String(group.routeCode || "").split("->").pop()?.trim();
      if (
        !group.destination ||
        group.destination === routeDest ||
        group.destination === "ODI" ||
        group.destination === "DEST" ||
        group.destination === "UNKNOWN"
      ) {
        group.destination = hubDestination;
      }
    });
  }

  const shippingRef =
    delivery.shippingManifestReference ||
    tripData.manifestId ||
    deliveryManifestDoc?.shippingManifestReference ||
    null;

  return {
    tripId: payload.tripId,
    tripNumber: payload.tripCode,
    version: delivery.version,
    status: delivery.status,
    sealedAt: delivery.completedAt,
    completedByName: delivery.completedByName,
    manifestHash: delivery.hash,
    verifyUrl: delivery.verifyUrl,
    stamps: ["COMPLETED", "OFFICIAL_RECORD"],
    totals: delivery.summary,
    shippingManifestReference: shippingRef,
    origin:
      payload.manifests.shipping.summary.origin ||
      tripData.origin ||
      deliveryManifestDoc?.trip?.origin ||
      "Divisoria Hub",
    destination:
      payload.manifests.shipping.summary.destination ||
      tripData.destination ||
      deliveryManifestDoc?.trip?.destination ||
      "Odiongan Hub",
    route:
      payload.manifests.shipping.summary.route ||
      tripData.route ||
      deliveryManifestDoc?.trip?.route ||
      "—",
    destinations,
    shipmentLedger: buildDeliveryManifestShipments(shipments),
  };
}
