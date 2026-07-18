import AsyncStorage from "@react-native-async-storage/async-storage";

export function cacheKey(prefix, checkerId) {
  return `atlas_offline_${prefix}_${String(checkerId || "").trim()}`;
}

export async function readJson(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("offlineStorage read failed:", key, error);
    return fallback;
  }
}

const MAX_SAFE_STORAGE_BYTES = 4_000_000;

function isStorageQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return [
    "quota",
    "quotaexceeded",
    "exceeded",
    "domexception",
    "diskquota",
  ].some((term) => message.includes(term));
}

export async function writeJson(key, value) {
  const json = JSON.stringify(value);
  if (json.length > MAX_SAFE_STORAGE_BYTES) {
    console.warn(
      "offlineStorage write skipped because payload exceeds safe quota:",
      key,
      json.length,
    );
    return;
  }

  try {
    await AsyncStorage.setItem(key, json);
  } catch (error) {
    if (isStorageQuotaError(error)) {
      console.warn("offlineStorage write quota exceeded for", key, error);
      try {
        await AsyncStorage.removeItem(key);
      } catch (cleanupError) {
        console.warn("offlineStorage cleanup failed for", key, cleanupError);
      }
      return;
    }
    throw error;
  }
}

export function generateOperationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Strip Firestore Timestamp-like fields for JSON round-trip. */
export function serializeShipment(shipment) {
  if (!shipment) return shipment;
  const copy = { ...shipment };
  ["createdAt", "updatedAt", "releasedAt", "deliveredAt"].forEach((field) => {
    const value = copy[field];
    if (value && typeof value.toMillis === "function") {
      copy[field] = { _seconds: Math.floor(value.toMillis() / 1000) };
    }
  });
  return copy;
}

export function deserializeShipmentsMap(map = {}) {
  return Object.fromEntries(
    Object.entries(map).map(([id, shipment]) => [
      id,
      { ...shipment, id: shipment.id || id },
    ]),
  );
}
