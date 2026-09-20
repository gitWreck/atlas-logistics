import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { invoiceBelongsToTrip } from "@/lib/invoiceTripMembership.mjs";

export async function getManifestTripShipments(tripId) {
  const normalizedTripId = String(tripId || "").trim();
  if (!normalizedTripId) {
    return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
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
    !["admin", "manager"].includes(userData.role?.toLowerCase())
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tripRef = adminDb.collection("truck_trips").doc(normalizedTripId);
  const [snapshot, tripSnap] = await Promise.all([
    tripRef.collection("trip_shipments").orderBy("createdAt", "desc").get(),
    tripRef.get(),
  ]);

  const shipmentIds = snapshot.docs.map((doc) => doc.id);
  const rootRefs = shipmentIds.map((id) =>
    adminDb.collection("shipments").doc(id),
  );
  const rootSnaps = rootRefs.length ? await adminDb.getAll(...rootRefs) : [];

  const rootMap = {};
  rootSnaps.forEach((snap) => {
    if (snap.exists) {
      rootMap[snap.id] = snap.data();
    }
  });

  const actorUidSet = new Set();
  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    collectActorUids(data, actorUidSet);
  });

  const activeInvoiceIds = [
    ...new Set(
      Object.values(rootMap)
        .filter(
          (shipment) =>
            shipment?.invoiceId &&
            String(shipment.invoiceStatus || "").toUpperCase() !== "CANCELLED",
        )
        .map((shipment) => String(shipment.invoiceId)),
    ),
  ];
  const invoiceRefs = activeInvoiceIds.map((id) =>
    adminDb.collection("invoices").doc(id),
  );
  const [actorNameByUid, invoiceSnaps] = await Promise.all([
    resolveUserDisplayNames([...actorUidSet]),
    invoiceRefs.length ? adminDb.getAll(...invoiceRefs) : [],
  ]);
  const invoiceMap = {};
  invoiceSnaps.forEach((snap) => {
    if (snap.exists) invoiceMap[snap.id] = snap.data() || {};
  });

  const shipments = snapshot.docs.map((doc) => {
    const data = doc.data();
    const root = rootMap[doc.id] || {};
    const rootPackages = Array.isArray(root.packages) ? root.packages : [];
    const tripBarcodeSet = new Set(
      (data.packageBarcodes || []).filter(Boolean).map(String),
    );
    const packageQty = (pkg) => Math.max(Number(pkg.quantity) || 1, 1);
    const tripPackages = rootPackages.filter((pkg) => {
      const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;
      const packageId = pkg.packageId || pkg.trackingNumber || null;

      if (packageTripId) return packageTripId === normalizedTripId;
      if (!packageId || !tripBarcodeSet.has(String(packageId))) return false;

      const loadedQty = Math.min(Number(pkg.loadedQty) || 0, packageQty(pkg));
      const receivedQty = Math.min(
        Number(pkg.receivedQty) || 0,
        packageQty(pkg),
      );
      if (loadedQty > 0 || receivedQty > 0) return true;

      return [
        "LOADED",
        "LOADED_TO_TRIP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "ARRIVED_AT_ODIONGAN",
      ].includes(String(pkg.status || "").toUpperCase());
    });
    const hasPackageScopedManifest = tripPackages.length || tripBarcodeSet.size;
    const visiblePackages = hasPackageScopedManifest
      ? tripPackages
      : rootPackages;
    const sumQty = (field) =>
      visiblePackages.reduce(
        (sum, pkg) => sum + Math.min(Number(pkg[field]) || 0, packageQty(pkg)),
        0,
      );
    const shipmentFullPieceTotal = Math.max(
      Number(root.totals?.totalContentQty) || 0,
      Number(root.totals?.totalItems) || 0,
      rootPackages.reduce((sum, pkg) => sum + packageQty(pkg), 0),
      (root.packageBarcodes || []).length,
    );
    const tripScopedPieceTotal = hasPackageScopedManifest
      ? Math.max(
          visiblePackages.reduce((sum, pkg) => sum + packageQty(pkg), 0),
          Number(data.loadedCount) || 0,
          tripBarcodeSet.size,
        )
      : Math.max(
          Number(data.loadedCount) || 0,
          Number(data.totalItems) || 0,
          tripBarcodeSet.size,
        );
    const visibleLoadedQty =
      data.loadedCount ?? sumQty("loadedQty") ?? root.totals?.loaded ?? 0;
    const visibleReceivedQty =
      data.receivedCount ??
      data.deliveredCount ??
      sumQty("receivedQty") ??
      root.totals?.received ??
      0;
    const visibleMissingQty =
      data.missingCount ?? sumQty("missingQty") ?? root.totals?.missing ?? 0;
    const visibleDamagedQty =
      data.damagedCount ?? sumQty("damagedQty") ?? root.totals?.damaged ?? 0;
    const visiblePendingQty =
      data.pendingCount ??
      Math.max(
        tripScopedPieceTotal -
          visibleLoadedQty -
          visibleReceivedQty -
          visibleMissingQty -
          visibleDamagedQty,
        0,
      );
    const linkedInvoice = root.invoiceId
      ? invoiceMap[String(root.invoiceId)] || null
      : null;
    const invoiceStatus = linkedInvoice?.status || root.invoiceStatus || null;
    const rawInvoiceAmount = linkedInvoice?.amount ?? root.invoiceAmount ?? 0;
    const parsedInvoiceAmount = Number(rawInvoiceAmount);
    const hasActiveInvoice =
      String(invoiceStatus || "").toUpperCase() !== "CANCELLED" &&
      invoiceBelongsToTrip(linkedInvoice, normalizedTripId) &&
      (root.hasInvoice || Boolean(root.invoiceId));

    const customAddedBy =
      data.customAddedBy ||
      (data.customAdded === true ? data.createdBy || null : null);
    const customAddedByName = resolveActorName(
      data.customAddedByName,
      customAddedBy,
      actorNameByUid,
    );
    const customAddedPackageEntries = enrichActorPackageEntries(
      serializeActorPackageEntries(data.customAddedPackageEntries, "addedAt"),
      {
        fallbackName: customAddedByName,
        fallbackAt: serializeTimestamp(data.customAddedAt) ||
          (data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : null),
        fallbackBy: customAddedBy,
        nameByUid: actorNameByUid,
        packageIds: data.customAddedPackageIds,
      },
    );

    return {
      id: doc.id,
      ...data,
      shipmentId: data.shipmentId || root.id || doc.id,
      trackingShipmentId:
        data.trackingShipmentId ||
        root.trackingNumber ||
        root.shipmentId ||
        doc.id,
      sender: root.sender || data.sender || null,
      recipient: root.recipient || data.recipient || null,
      origin: root.origin || data.origin || null,
      originCode: root.originCode || data.originCode || null,
      destination: root.destination || data.destination || null,
      destinationCode: root.destinationCode || data.destinationCode || null,
      route:
        data.route ||
        root.route ||
        `${root.origin || data.origin || "Unknown"} -> ${
          root.destination || data.destination || "Unknown"
        }`,
      status: root.status || data.status || null,
      masterStatus: root.status || data.status || null,
      packageBreakdown: root.packageBreakdown || null,
      releasedForDeliveryAt: root.releasedForDeliveryAt || null,
      availableForDelivery: root.availableForDelivery === true,
      currentTripId:
        root.currentTripId || data.currentTripId || normalizedTripId,
      packages: visiblePackages,
      packageBarcodes:
        data.packageBarcodes || visiblePackages.map((pkg) => pkg.packageId),
      totals: {
        ...(root.totals || {}),
        totalItems: hasPackageScopedManifest
          ? visiblePackages.length
          : tripScopedPieceTotal,
        totalContentQty: shipmentFullPieceTotal,
        tripPieceTotal: tripScopedPieceTotal,
        loaded: visibleLoadedQty,
        received: visibleReceivedQty,
        delivered: visibleReceivedQty,
        pending: visiblePendingQty,
        missing: visibleMissingQty,
        damaged: visibleDamagedQty,
      },
      shipmentPieceTotal: shipmentFullPieceTotal,
      totalItems: tripScopedPieceTotal,
      loadedCount: visibleLoadedQty,
      receivedCount: visibleReceivedQty,
      deliveredCount: visibleReceivedQty,
      pendingCount: visiblePendingQty,
      hasInvoice: hasActiveInvoice,
      invoiceId: hasActiveInvoice ? root.invoiceId || null : null,
      invoiceNumber: hasActiveInvoice ? root.invoiceNumber || null : null,
      invoiceStatus,
      invoiceAmount:
        hasActiveInvoice && Number.isFinite(parsedInvoiceAmount)
          ? parsedInvoiceAmount
          : 0,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : null,
      updatedAt: data.updatedAt?.toDate
        ? data.updatedAt.toDate().toISOString()
        : null,
      customAddedAt:
        serializeTimestamp(data.customAddedAt) ||
        (data.customAdded === true && data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null),
      customAddedBy,
      customAddedByName,
      customAddedPackageEntries,
      removedPackageEntries: serializeActorPackageEntries(
        data.removedPackageEntries,
        "removedAt",
      ),
    };
  });

  return NextResponse.json({
    shipments,
    removedManifestEntries: serializeRemovedManifestEntries(
      tripSnap.exists ? tripSnap.data()?.removedManifestEntries : [],
    ),
  });
}

function looksLikeUserId(value) {
  const text = String(value || "").trim();
  if (!text || /\s/.test(text)) return false;
  return /^[A-Za-z0-9_-]{20,}$/.test(text);
}

function collectActorUids(data = {}, uidSet) {
  const maybeAdd = (uid, hasName) => {
    if (!hasName && looksLikeUserId(uid)) uidSet.add(String(uid));
  };

  maybeAdd(
    data.customAdded === true ? data.customAddedBy || data.createdBy : data.customAddedBy,
    Boolean(data.customAddedByName),
  );

  for (const entry of data.customAddedPackageEntries || []) {
    maybeAdd(entry?.addedBy, Boolean(entry?.addedByName));
  }
  for (const entry of data.removedPackageEntries || []) {
    maybeAdd(entry?.removedBy, Boolean(entry?.removedByName));
  }
}

async function resolveUserDisplayNames(uids = []) {
  const unique = [...new Set(uids.map(String).filter(Boolean))];
  const nameByUid = new Map();
  if (!unique.length) return nameByUid;

  const refs = unique.map((uid) => adminDb.collection("users").doc(uid));
  const snaps = await adminDb.getAll(...refs);
  snaps.forEach((snap, index) => {
    if (!snap.exists) return;
    const user = snap.data() || {};
    const name =
      user.name ||
      user.displayName ||
      user.fullName ||
      user.email ||
      unique[index];
    nameByUid.set(unique[index], name);
  });
  return nameByUid;
}

function resolveActorName(existingName, uid, nameByUid) {
  if (existingName) return existingName;
  if (!uid) return null;
  if (!looksLikeUserId(uid)) return String(uid);
  return nameByUid.get(String(uid)) || null;
}

function enrichActorPackageEntries(
  entries = [],
  {
    fallbackName = null,
    fallbackAt = null,
    fallbackBy = null,
    nameByUid = new Map(),
    packageIds = [],
  } = {},
) {
  const byPackageId = new Map();

  for (const entry of entries) {
    const packageId = String(entry?.packageId || "").trim();
    if (!packageId) continue;
    byPackageId.set(packageId, {
      ...entry,
      addedBy: entry.addedBy || fallbackBy || null,
      addedByName: resolveActorName(
        entry.addedByName,
        entry.addedBy || fallbackBy,
        nameByUid,
      ) || fallbackName,
      addedAt: entry.addedAt || fallbackAt,
    });
  }

  for (const rawId of packageIds || []) {
    const packageId = String(rawId || "").trim();
    if (!packageId || byPackageId.has(packageId)) continue;
    byPackageId.set(packageId, {
      packageId,
      addedBy: fallbackBy || null,
      addedByName: fallbackName || null,
      addedAt: fallbackAt || null,
      addedVia: null,
    });
  }

  return [...byPackageId.values()];
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate().toISOString();
  return value;
}

function serializeActorPackageEntries(entries, atField) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    packageId: entry?.packageId || null,
    addedBy: entry?.addedBy || null,
    addedByName: entry?.addedByName || null,
    addedVia: entry?.addedVia || null,
    removedBy: entry?.removedBy || null,
    removedByName: entry?.removedByName || null,
    [atField]: serializeTimestamp(entry?.[atField]),
  }));
}

function serializeRemovedManifestEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    const removedAt = entry?.removedAt;
    return {
      shipmentDocId: entry?.shipmentDocId || null,
      shipmentId: entry?.shipmentId || entry?.shipmentDocId || null,
      packageId: entry?.packageId || null,
      packageIds: Array.isArray(entry?.packageIds)
        ? entry.packageIds.map(String).filter(Boolean)
        : entry?.packageId
          ? [String(entry.packageId)]
          : [],
      recipientName: entry?.recipientName || null,
      destinationCity: entry?.destinationCity || null,
      reason: entry?.reason || null,
      removedBy: entry?.removedBy || null,
      removedByName: entry?.removedByName || null,
      removedAt:
        removedAt?.toDate
          ? removedAt.toDate().toISOString()
          : removedAt || null,
    };
  });
}
