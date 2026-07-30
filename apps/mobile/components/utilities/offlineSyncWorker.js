import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import {
  completeCheckerDelivery,
  getCallableErrorMessage,
  loadAssignedShipmentsToVehicle,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "./checkerDelivery";
import { deleteOfflinePhotos } from "./offlinePhotoStore";
import {
  QUEUE_STATUS,
  updateOperation,
  formatOfflineOperationLabel,
} from "./offlineQueue";
import { resolveShipmentIdByPackageBarcode } from "./offlineShipmentResolve";

async function resolveShipmentIdForOperation(operation) {
  const packageIds = Array.isArray(operation.packageIds)
    ? operation.packageIds
    : [];
  const candidates = [
    operation.shipmentId,
    packageIds[0],
    operation.barcode,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const tried = new Set();
  for (const code of candidates) {
    const key = code.toUpperCase();
    if (tried.has(key)) continue;
    tried.add(key);
    const resolved = await resolveShipmentIdByPackageBarcode(code);
    if (resolved) return resolved;
  }
  return null;
}

async function uploadLocalPhotos(shipmentId, localPaths = []) {
  const urls = [];
  for (let i = 0; i < localPaths.length; i += 1) {
    const uri = localPaths[i];
    const filename = `proof_${shipmentId}_${Date.now()}_${i}.jpg`;
    const storageRef = ref(storage, `shipments/${shipmentId}/${filename}`);
    const response = await fetch(uri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob);
    urls.push(await getDownloadURL(storageRef));
  }
  return urls;
}

export async function replayOfflineOperation(operation, profile) {
  const type = String(operation.type || "").trim().toUpperCase();
  const shipmentId = operation.shipmentId;
  const packageIds = Array.isArray(operation.packageIds)
    ? operation.packageIds
    : [];
  const location = operation.location || null;
  const remarks = operation.remarks || "";
  const notificationChannels = operation.notificationChannels || {
    sms: false,
    email: false,
    push: false,
  };

  if (type === "LOAD_TO_VEHICLE") {
    const loadPackageIds =
      packageIds.length > 0
        ? packageIds
        : [operation.barcode].filter(Boolean);
    if (!shipmentId && loadPackageIds.length === 0) {
      throw new Error("Missing package label for offline load sync.");
    }

    await loadAssignedShipmentsToVehicle({
      shipmentIds: shipmentId ? [shipmentId] : [],
      packageIds: loadPackageIds,
      profile,
      remarks:
        remarks ||
        (operation.blindQueue
          ? "Blind offline load — verified on sync."
          : "Loaded offline — synced from checker app."),
    });
    return;
  }

  if (type === "DELIVERED") {
    const deliveryPackageIds =
      packageIds.length > 0
        ? packageIds
        : [operation.barcode].filter(Boolean);
    const resolvedShipmentId = await resolveShipmentIdForOperation(operation);
    if (!resolvedShipmentId) {
      throw new Error(
        `Shipment not found for ${deliveryPackageIds[0] || "package"}.`,
      );
    }

    const photoUrls = Array.isArray(operation.localPhotoPaths)
      ? await uploadLocalPhotos(resolvedShipmentId, operation.localPhotoPaths)
      : [];

    await completeCheckerDelivery({
      shipmentId: resolvedShipmentId,
      packageIds: deliveryPackageIds,
      profile,
      tripId: operation.tripId || null,
      location,
      photoUrls,
      shipment: operation.shipmentSnapshot || null,
      notificationChannels,
    });

    if (operation.localPhotoPaths?.length) {
      await deleteOfflinePhotos(operation.localPhotoPaths);
    }
    return;
  }

  if (type === "FAILED_DELIVERY") {
    const failPackageIds =
      packageIds.length > 0
        ? packageIds
        : [operation.barcode].filter(Boolean);
    await reportCheckerFailedDelivery({
      shipmentIds: shipmentId ? [shipmentId] : [],
      packageIds: failPackageIds,
      profile,
      reasonCode: operation.reasonCode || "DELIVERY_FAILED",
      remarks:
        remarks ||
        (operation.blindQueue
          ? "Blind offline failed delivery — verified on sync."
          : "Failed delivery reported offline — synced from checker app."),
    });
    return;
  }

  if (type === "RETURNED_TO_WAREHOUSE") {
    const returnPackageIds =
      packageIds.length > 0
        ? packageIds
        : [operation.barcode].filter(Boolean);
    await returnCheckerShipmentsToWarehouse({
      shipmentIds: shipmentId ? [shipmentId] : [],
      packageIds: returnPackageIds,
      profile,
      remarks:
        remarks ||
        (operation.blindQueue
          ? "Blind offline return — verified on sync."
          : "Returned offline — synced from checker app."),
    });
    return;
  }

  throw new Error(`Unsupported offline operation type: ${type}`);
}

export async function syncPendingOperations({
  checkerId,
  profile,
  operations,
  onProgress,
}) {
  const results = { synced: 0, failed: 0, errors: [] };

  for (const operation of operations) {
    if (
      operation.status !== QUEUE_STATUS.PENDING &&
      operation.status !== QUEUE_STATUS.FAILED
    ) {
      continue;
    }

    await updateOperation(checkerId, operation.id, {
      status: QUEUE_STATUS.SYNCING,
      syncingStartedAt: Date.now(),
      lastError: null,
    });
    onProgress?.({ operation, phase: "syncing" });

    try {
      await replayOfflineOperation(operation, profile);
      await updateOperation(checkerId, operation.id, {
        status: QUEUE_STATUS.SYNCED,
        syncedAt: Date.now(),
        lastError: null,
      });
      results.synced += 1;
      onProgress?.({ operation, phase: "synced" });
    } catch (error) {
      const message = getCallableErrorMessage(error, "Sync failed.");
      await updateOperation(checkerId, operation.id, {
        status: QUEUE_STATUS.FAILED,
        retryCount: (operation.retryCount || 0) + 1,
        lastError: message,
      });
      results.failed += 1;
      results.errors.push({
        operationId: operation.id,
        type: operation.type,
        barcode: operation.barcode,
        label: formatOfflineOperationLabel(operation),
        message,
      });
      onProgress?.({ operation, phase: "failed", error: message });
    }
  }

  return results;
}
