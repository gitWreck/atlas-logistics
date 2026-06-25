import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

export async function resolveShipmentIdByPackageBarcode(barcode) {
  const code = String(barcode || "").trim();
  if (!code) return null;

  const snap = await getDocs(
    query(
      collection(db, "shipments"),
      where("packageBarcodes", "array-contains", code),
      limit(1),
    ),
  );

  return snap.empty ? null : snap.docs[0].id;
}
