import {
  deriveParentShipmentCode,
  findPackageInShipment,
  normalizeScanCode,
} from "./scanner";
import { buildTripBarcodeIndex } from "./scanLookup";

function asShipmentDoc(shipment) {
  return {
    id: shipment.id,
    exists: () => true,
    data: () => shipment,
  };
}

function shipmentCodesForMatch(shipment = {}) {
  return [
    shipment.trackingNumber,
    shipment.shipmentId,
    shipment.id,
  ]
    .map(normalizeScanCode)
    .filter(Boolean);
}

function syntheticPackageFromBarcode(shipment, barcode) {
  const existing = findPackageInShipment(shipment, barcode);
  if (existing) return existing;

  const code = String(barcode || "").trim();
  return {
    packageId: code,
    trackingNumber: code,
    status: "RELEASED_FOR_DELIVERY",
    availableForDelivery: true,
  };
}

function buildLookupHit(shipment, pkg, scanType, barcode) {
  const doc = asShipmentDoc(shipment);
  return {
    shipmentDoc: doc,
    shipmentData: shipment,
    pkg:
      scanType === "package"
        ? pkg || syntheticPackageFromBarcode(shipment, barcode)
        : null,
    scanType,
  };
}

function indexPackageBarcodes(index, shipment) {
  const doc = asShipmentDoc(shipment);
  const shipmentData = shipment;
  const packageBarcodes = Array.isArray(shipment.packageBarcodes)
    ? shipment.packageBarcodes
    : [];

  packageBarcodes.forEach((code) => {
    const normalized = normalizeScanCode(code);
    if (!normalized || index.has(normalized)) return;

    const pkg = findPackageInShipment(shipmentData, normalized);
    index.set(normalized, {
      shipmentDoc: doc,
      shipmentData,
      pkg: pkg || syntheticPackageFromBarcode(shipmentData, code),
      scanType: "package",
    });
  });
}

export function buildShipmentMapBarcodeIndex(shipmentsById = {}) {
  const snapshots = Object.values(shipmentsById).map((shipment) =>
    asShipmentDoc(shipment),
  );
  const index = buildTripBarcodeIndex(snapshots);

  Object.values(shipmentsById).forEach((shipment) => {
    indexPackageBarcodes(index, shipment);
  });

  return index;
}

/**
 * Resolve a barcode against locally cached shipments (no network).
 */
export function lookupScannedShipmentOffline(
  barcode,
  shipmentsById = {},
  tripIndex = null,
) {
  const normalizedBarcode = normalizeScanCode(barcode);
  const rawBarcode = String(barcode || "").trim();
  const barcodeVariants = [
    ...new Set([normalizedBarcode, rawBarcode].filter(Boolean)),
  ];
  const parentCode = deriveParentShipmentCode(normalizedBarcode);

  if (!normalizedBarcode) {
    throw new Error("Invalid scan code.");
  }

  const index = tripIndex || buildShipmentMapBarcodeIndex(shipmentsById);

  for (const variant of barcodeVariants) {
    const hit = index.get(normalizeScanCode(variant));
    if (hit) return hit;
  }

  for (const shipment of Object.values(shipmentsById)) {
    for (const variant of barcodeVariants) {
      const pkg = findPackageInShipment(shipment, variant);
      if (pkg) {
        return buildLookupHit(shipment, pkg, "package", variant);
      }
    }

    const packageBarcodes = Array.isArray(shipment.packageBarcodes)
      ? shipment.packageBarcodes
      : [];
    for (const variant of barcodeVariants) {
      const needle = normalizeScanCode(variant);
      if (packageBarcodes.some((code) => normalizeScanCode(code) === needle)) {
        return buildLookupHit(
          shipment,
          syntheticPackageFromBarcode(shipment, variant),
          "package",
          variant,
        );
      }
    }

    if (parentCode && shipmentCodesForMatch(shipment).includes(parentCode)) {
      for (const variant of barcodeVariants) {
        const pkg = findPackageInShipment(shipment, variant);
        if (pkg) {
          return buildLookupHit(shipment, pkg, "package", variant);
        }
      }
      for (const variant of barcodeVariants) {
        const needle = normalizeScanCode(variant);
        if (
          packageBarcodes.some((code) => normalizeScanCode(code) === needle)
        ) {
          return buildLookupHit(
            shipment,
            syntheticPackageFromBarcode(shipment, variant),
            "package",
            variant,
          );
        }
      }
    }

    for (const variant of barcodeVariants) {
      if (shipmentCodesForMatch(shipment).includes(normalizeScanCode(variant))) {
        return buildLookupHit(shipment, null, "shipment", variant);
      }
    }
  }

  return null;
}
