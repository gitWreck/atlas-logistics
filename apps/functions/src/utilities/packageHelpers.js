"use strict";

function normalizeQty(value, fallback = 0) {
  const qty = Number(value);
  return Number.isFinite(qty) && qty >= 0 ? qty : fallback;
}

function isBundlePackaging(packagingGroup) {
  const value = String(packagingGroup || "")
    .trim()
    .toUpperCase();
  return value === "BULK";
}

function shouldUseBundleMode(items = []) {
  return items.some((item) => isBundlePackaging(item?.packagingGroup));
}

function buildPackages({
  items,
  shipmentId,
  initialStatus,
  currentLocation,
  originSummary,
  bundleMode,
  updatedBy,
}) {
  const packagesArray = [];
  const packageBarcodes = [];

  let totalContentQuantity = 0;
  let globalSeq = 1;

  items.forEach((item, itemIndex) => {
    const qty = Number(item.quantity || item.weight) || 1;
    const packagingType = item.packagingType || item.packaging || "Box";
    const isBundled =
      bundleMode ||
      isBundlePackaging(item.packagingGroup) ||
      packagingType === "Sack" ||
      packagingType === "Bundle";

    totalContentQuantity += qty;

    if (isBundled) {
      const sequence = bundleMode ? itemIndex + 1 : globalSeq;
      const seqNum = String(sequence).padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;

      packagesArray.push({
        packageId: pkgId,
        trackingNumber: pkgId,
        sequence,
        description: item.description || "Bundled Cargo",
        quantity: qty,
        packagingGroup: item.packagingGroup || "BULK",
        packagingType: item.packagingType || item.packaging || "Sack",
        declaredValue: Number(item.declaredValue) || 0,
        isFragile: Boolean(item.isFragile),
        isPerishable: Boolean(item.isPerishable),
        status: initialStatus,
        billingStatus: "NOT_INVOICED",
        currentLocation: currentLocation || originSummary,
        loadedOnTrip: null,
        loadedAt: null,
        isDelayed: false,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      packageBarcodes.push(pkgId);
      if (!bundleMode) globalSeq += 1;
      return;
    }

    for (let index = 0; index < qty; index += 1) {
      const seqNum = String(globalSeq).padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;

      packagesArray.push({
        packageId: pkgId,
        trackingNumber: pkgId,
        sequence: globalSeq,
        description: item.description || "Standard Package",
        quantity: 1,
        packagingGroup: item.packagingGroup || "SINGLE",
        packagingType,
        declaredValue: (Number(item.declaredValue) || 0) / qty,
        isFragile: Boolean(item.isFragile),
        isPerishable: Boolean(item.isPerishable),
        status: initialStatus,
        billingStatus: "NOT_INVOICED",
        currentLocation: currentLocation || originSummary,
        loadedOnTrip: null,
        loadedAt: null,
        isDelayed: false,
        updatedAt: new Date().toISOString(),
        updatedBy,
      });

      packageBarcodes.push(pkgId);
      globalSeq += 1;
    }
  });

  return {
    packagesArray,
    packageBarcodes,
    totalContentQuantity,
  };
}

module.exports = {
  buildPackages,
  isBundlePackaging,
  normalizeQty,
  shouldUseBundleMode,
};
