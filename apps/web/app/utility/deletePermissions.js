const SHIPMENT_TRIP_DELETE_MANAGER_EMAIL = "roselyn@gmail.com";

function resolveActorEmail(profile, user) {
  return String(profile?.email || user?.email || "").toLowerCase();
}

export function canDeleteShipmentsAndTrips(profile, user = null) {
  const role = String(profile?.role || "").toLowerCase();
  const email = resolveActorEmail(profile, user);

  if (role === "admin") return true;
  return role === "manager" && email === SHIPMENT_TRIP_DELETE_MANAGER_EMAIL;
}
