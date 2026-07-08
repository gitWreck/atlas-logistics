import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { parsePackageIdentity } from "@/app/utility/reconciliationPieces";

export const TRACKING_CODE_PATTERN =
  /^AT-\d{8}-SHP-[A-Z0-9-]+(?:-\d{2})?$/i;

export function normalizeTrackingCode(code = "") {
  return String(code || "").trim().toUpperCase();
}

function isPieceLabel(code = "") {
  return /-\d{2}$/.test(normalizeTrackingCode(code));
}

async function resolveShipmentDoc(code) {
  const clean = normalizeTrackingCode(code);
  if (!clean) return null;

  const directSnap = await adminDb.collection("shipments").doc(clean).get();
  if (directSnap.exists) {
    return {
      shipmentDocId: directSnap.id,
      shipment: directSnap.data() || {},
      matchedBy: "document_id",
      matchedPackageId: null,
    };
  }

  const byBarcodeSnap = await adminDb
    .collection("shipments")
    .where("packageBarcodes", "array-contains", clean)
    .limit(1)
    .get();

  if (!byBarcodeSnap.empty) {
    const docSnap = byBarcodeSnap.docs[0];
    return {
      shipmentDocId: docSnap.id,
      shipment: docSnap.data() || {},
      matchedBy: "package_label",
      matchedPackageId: clean,
    };
  }

  const byPublicIdSnap = await adminDb
    .collection("shipments")
    .where("shipmentId", "==", clean)
    .limit(1)
    .get();

  if (!byPublicIdSnap.empty) {
    const docSnap = byPublicIdSnap.docs[0];
    return {
      shipmentDocId: docSnap.id,
      shipment: docSnap.data() || {},
      matchedBy: "shipment_id",
      matchedPackageId: null,
    };
  }

  if (isPieceLabel(clean)) {
    const { shipmentId } = parsePackageIdentity(clean);
    if (shipmentId && shipmentId !== clean) {
      const parentSnap = await adminDb.collection("shipments").doc(shipmentId).get();
      if (parentSnap.exists) {
        const packages = Array.isArray(parentSnap.data()?.packages)
          ? parentSnap.data().packages
          : [];
        const hasPackage = packages.some((pkg) => {
          const identity = String(pkg.packageId || pkg.trackingNumber || "").trim();
          return identity === clean;
        });

        if (hasPackage) {
          return {
            shipmentDocId: parentSnap.id,
            shipment: parentSnap.data() || {},
            matchedBy: "package_identity",
            matchedPackageId: clean,
          };
        }
      }
    }
  }

  return null;
}

async function loadPublicTracking(shipmentId) {
  const snap = await adminDb.collection("tracking_public").doc(shipmentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Resolve a customer tracking code to public tracking data.
 * Supports shipment IDs and package/piece labels.
 */
export async function resolveTrackingCode(code = "") {
  const searchedCode = normalizeTrackingCode(code);
  if (!searchedCode) {
    return {
      found: false,
      message: "Enter a shipment or package tracking number.",
    };
  }

  if (!TRACKING_CODE_PATTERN.test(searchedCode)) {
    return {
      found: false,
      message:
        "Use a valid Atlas tracking number (e.g. AT-20260628-SHP-792867 or …-02).",
    };
  }

  const directPublic = await loadPublicTracking(searchedCode);
  if (directPublic) {
    return {
      found: true,
      searchedCode,
      shipmentId: searchedCode,
      matchType: "shipment",
      matchedPackageId: null,
      tracking: directPublic,
    };
  }

  const resolved = await resolveShipmentDoc(searchedCode);
  if (!resolved) {
    return {
      found: false,
      message: "Tracking number not found. Please check your ID.",
    };
  }

  const shipmentId =
    resolved.shipment.shipmentId || resolved.shipmentDocId;
  const publicTracking = await loadPublicTracking(shipmentId);

  if (!publicTracking) {
    return {
      found: false,
      message: "Tracking number not found. Please check your ID.",
    };
  }

  const matchedPackageId =
    resolved.matchedPackageId ||
    (isPieceLabel(searchedCode) ? searchedCode : null);

  return {
    found: true,
    searchedCode,
    shipmentId,
    matchType: matchedPackageId ? "package" : "shipment",
    matchedPackageId,
    tracking: publicTracking,
  };
}
