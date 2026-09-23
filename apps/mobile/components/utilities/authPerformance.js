function getUsableCachedAuthProfile(
  serializedProfile,
  { uid, allowedRoles = [] } = {},
) {
  if (!serializedProfile || !uid) return null;

  try {
    const profile =
      typeof serializedProfile === "string"
        ? JSON.parse(serializedProfile)
        : serializedProfile;
    if (!profile || String(profile.uid || "") !== String(uid)) return null;

    const role = String(profile.role || "").trim().toLowerCase();
    if (!role || !allowedRoles.includes(role)) return null;

    const isActive =
      profile.active !== false &&
      String(profile.status || "").toLowerCase() !== "inactive" &&
      String(profile.employmentStatus || "").toLowerCase() !== "inactive";
    return isActive ? profile : null;
  } catch {
    return null;
  }
}

module.exports = { getUsableCachedAuthProfile };
