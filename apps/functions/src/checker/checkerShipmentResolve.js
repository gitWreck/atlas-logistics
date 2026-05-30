"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

function normalizeStringList(values = []) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return [...unique];
}

async function resolveShipmentIds(db, { shipmentIds, packageIds }) {
  const normalizedShipmentIds = normalizeStringList(shipmentIds);
  if (normalizedShipmentIds.length > 0) return normalizedShipmentIds;

  const normalizedPackageIds = normalizeStringList(packageIds);
  if (normalizedPackageIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Provide shipmentIds or packageIds.",
    );
  }

  const resolvedIds = new Set();
  await Promise.all(
    normalizedPackageIds.map(async (packageId) => {
      const snap = await db
        .collection("shipments")
        .where("packageBarcodes", "array-contains", packageId)
        .limit(1)
        .get();
      if (!snap.empty) {
        resolvedIds.add(snap.docs[0].id);
      }
    }),
  );

  if (resolvedIds.size === 0) {
    throw new HttpsError(
      "not-found",
      "No shipments found for the provided packageIds.",
    );
  }

  return [...resolvedIds];
}

module.exports = {
  resolveShipmentIds,
};
