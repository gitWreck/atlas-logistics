import { adminDb } from "@/lib/firebase-admin";

function findPackageInShipment(shipmentData, barcode) {
  const code = String(barcode || "").trim();
  const packages = Array.isArray(shipmentData?.packages)
    ? shipmentData.packages
    : [];

  return packages.find((pkg) => {
    const ids = [pkg?.packageId, pkg?.trackingNumber]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return ids.includes(code);
  });
}

export async function resolveShipmentScan(barcode) {
  const code = String(barcode || "").trim();
  if (!code) return null;

  const packageQuery = await adminDb
    .collection("shipments")
    .where("packageBarcodes", "array-contains", code)
    .limit(1)
    .get();

  if (!packageQuery.empty) {
    const doc = packageQuery.docs[0];
    const shipmentData = doc.data();
    const pkg = findPackageInShipment(shipmentData, code);

    return {
      shipmentId: doc.id,
      shipmentData,
      packageId: pkg?.packageId || pkg?.trackingNumber || code,
      pkg,
      scanType: "package",
    };
  }

  const directDoc = await adminDb.collection("shipments").doc(code).get();
  if (directDoc.exists) {
    const shipmentData = directDoc.data();
    const firstPackage = Array.isArray(shipmentData?.packages)
      ? shipmentData.packages[0]
      : null;

    return {
      shipmentId: directDoc.id,
      shipmentData,
      packageId:
        firstPackage?.packageId || firstPackage?.trackingNumber || null,
      pkg: firstPackage,
      scanType: "shipment",
    };
  }

  const trackingQuery = await adminDb
    .collection("shipments")
    .where("trackingNumber", "==", code)
    .limit(1)
    .get();

  if (!trackingQuery.empty) {
    const doc = trackingQuery.docs[0];
    const shipmentData = doc.data();
    const firstPackage = Array.isArray(shipmentData?.packages)
      ? shipmentData.packages[0]
      : null;

    return {
      shipmentId: doc.id,
      shipmentData,
      packageId:
        firstPackage?.packageId || firstPackage?.trackingNumber || null,
      pkg: firstPackage,
      scanType: "shipment",
    };
  }

  return null;
}

export async function processCheckerScan({
  barcode,
  truckTripId,
  idToken,
  newStatus = "LOADED",
}) {
  const resolved = await resolveShipmentScan(barcode);
  if (!resolved) {
    const error = new Error("Barcode not found.");
    error.status = 404;
    throw error;
  }

  const { shipmentId, shipmentData, packageId, pkg, scanType } = resolved;

  if (!truckTripId) {
    const error = new Error("Trip is required before loading packages.");
    error.status = 400;
    throw error;
  }

  if (String(newStatus).toUpperCase() === "LOADED") {
    const currentStatus = String(pkg?.status || shipmentData?.status || "")
      .trim()
      .toUpperCase();
    if (currentStatus === "LOADED" && scanType === "package") {
      const error = new Error("Already loaded on this trip.");
      error.status = 400;
      throw error;
    }
  }

  const packageIds =
    scanType === "package" && packageId
      ? [packageId]
      : Array.isArray(shipmentData?.packageBarcodes)
        ? shipmentData.packageBarcodes.filter(Boolean)
        : packageId
          ? [packageId]
          : [];

  if (packageIds.length === 0) {
    const error = new Error("No package identifiers found for this shipment.");
    error.status = 400;
    throw error;
  }

  const { invokeCallable } = await import("@/lib/invokeCallable");
  const result = await invokeCallable(
    "updateShipmentPackages",
    {
      shipmentId,
      packageIds,
      newStatus,
      tripId: truckTripId,
      scanAction: "loading",
      remarks: `Web checker scan: ${barcode}`,
    },
    idToken,
  );

  return {
    success: true,
    message: "Package scan processed.",
    shipmentId,
    packageIds,
    scanType,
    result,
  };
}
