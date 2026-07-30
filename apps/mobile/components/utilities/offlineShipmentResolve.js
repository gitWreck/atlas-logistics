import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { resolveShipmentByLabel } from "./FirebaseFunctions";
import { deriveParentShipmentCode } from "./scanner";

function normalizeCode(value) {
  return String(value || "").trim();
}

async function tryGetShipmentDocId(code) {
  const id = normalizeCode(code);
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "shipments", id));
    return snap.exists() ? snap.id : null;
  } catch (error) {
    console.warn("Shipment doc lookup failed:", id, error?.message || error);
    return null;
  }
}

async function tryQueryFirstShipmentId(constraints) {
  try {
    const snap = await getDocs(
      query(collection(db, "shipments"), ...constraints, limit(1)),
    );
    return snap.empty ? null : snap.docs[0].id;
  } catch (error) {
    console.warn(
      "Shipment query lookup failed:",
      error?.message || error,
    );
    return null;
  }
}

/**
 * Resolve a package/shipment label to a Firestore shipments doc id.
 * Mirrors server resolveShipmentReference, then falls back to Admin callable
 * (same reliability as offline load sync).
 */
export async function resolveShipmentIdByPackageBarcode(barcode) {
  const code = normalizeCode(barcode);
  if (!code) return null;

  const directId = await tryGetShipmentDocId(code);
  if (directId) return directId;

  const parentCode = deriveParentShipmentCode(code);
  if (parentCode) {
    const parentId = await tryGetShipmentDocId(parentCode);
    if (parentId) return parentId;
  }

  const byBarcode = await tryQueryFirstShipmentId([
    where("packageBarcodes", "array-contains", code),
  ]);
  if (byBarcode) return byBarcode;

  const byShipmentId = await tryQueryFirstShipmentId([
    where("shipmentId", "==", code),
  ]);
  if (byShipmentId) return byShipmentId;

  if (parentCode) {
    const byParentShipmentId = await tryQueryFirstShipmentId([
      where("shipmentId", "==", parentCode),
    ]);
    if (byParentShipmentId) return byParentShipmentId;
  }

  try {
    const result = await resolveShipmentByLabel({ code });
    const resolvedId = normalizeCode(result?.data?.shipmentId);
    if (resolvedId) return resolvedId;
  } catch (error) {
    console.warn(
      "resolveShipmentByLabel fallback failed:",
      code,
      error?.message || error,
    );
  }

  return null;
}
