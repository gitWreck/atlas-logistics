import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import {
  completeCheckerDelivery,
  loadAssignedShipmentsToVehicle,
  reportCheckerFailedDelivery,
  returnCheckerShipmentsToWarehouse,
} from "./checkerDelivery";
import { deleteOfflinePhotos } from "./offlinePhotoStore";
import { QUEUE_STATUS, updateOperation } from "./offlineQueue";

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
    await loadAssignedShipmentsToVehicle({
      shipmentIds: [shipmentId],
      packageIds,
      profile,
      remarks: remarks || "Loaded offline — synced from checker app.",
    });
    return;
  }

  if (type === "DELIVERED") {
    const photoUrls = Array.isArray(operation.localPhotoPaths)
      ? await uploadLocalPhotos(shipmentId, operation.localPhotoPaths)
      : [];

    await completeCheckerDelivery({
      shipmentId,
      packageIds,
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
    await reportCheckerFailedDelivery({
      shipmentIds: [shipmentId],
      packageIds,
      profile,
      reasonCode: operation.reasonCode || "DELIVERY_FAILED",
      remarks: remarks || "Failed delivery reported offline — synced from checker app.",
    });
    return;
  }

  if (type === "RETURNED_TO_WAREHOUSE") {
    await returnCheckerShipmentsToWarehouse({
      shipmentIds: [shipmentId],
      packageIds,
      profile,
      remarks: remarks || "Returned offline — synced from checker app.",
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
      const message = String(error?.message || "Sync failed.").trim();
      await updateOperation(checkerId, operation.id, {
        status: QUEUE_STATUS.FAILED,
        retryCount: (operation.retryCount || 0) + 1,
        lastError: message,
      });
      results.failed += 1;
      results.errors.push({ operationId: operation.id, message });
      onProgress?.({ operation, phase: "failed", error: message });
    }
  }

  return results;
}
