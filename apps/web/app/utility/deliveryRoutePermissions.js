const ROSE_WAREHOUSE_EMAIL = "roselyn@gmail.com";

export function canAssignDeliveryRoutes(profile = {}) {
  const role = String(profile?.role || "").toLowerCase();
  const email = String(profile?.email || "").toLowerCase();

  if (["admin", "superadmin"].includes(role)) return true;
  if (role === "manager") return true;
  if (email === ROSE_WAREHOUSE_EMAIL) return true;
  return false;
}
