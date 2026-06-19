export function canOverridePieceStatus(profile = null) {
  return ["admin", "manager"].includes(
    String(profile?.role || "").toLowerCase(),
  );
}

export function canOverrideShipmentStatus(profile = null) {
  return canOverridePieceStatus(profile);
}
