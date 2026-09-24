const NAVIGATION_RECORD_VERSION = 1;
const NAVIGATION_RECORD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const ALLOWED_GROUPS_BY_SCOPE = {
  checker: new Set(["(checker)"]),
  staff: new Set(["(checker)", "(manager)", "(staff)"]),
  driver: new Set(["(driver)"]),
  customer: new Set(["(customer)"]),
};

function getNavigationStorageKey(uid) {
  const normalizedUid = String(uid || "").trim();
  return normalizedUid ? `atlas_last_route_${normalizedUid}` : null;
}

function getNavigationScope({
  isStaff = false,
  isChecker = false,
  isDriver = false,
  isCustomer = false,
} = {}) {
  if (isStaff) return "staff";
  if (isChecker) return "checker";
  if (isDriver) return "driver";
  if (isCustomer) return "customer";
  return null;
}

function sanitizeParams(params = {}) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (!key || key.startsWith("__")) return [];
      if (typeof value === "string") {
        return [[key, value.slice(0, 500)]];
      }
      if (Array.isArray(value)) {
        const values = value
          .filter((item) => typeof item === "string")
          .slice(0, 10)
          .map((item) => item.slice(0, 500));
        return values.length ? [[key, values]] : [];
      }
      return [];
    }),
  );
}

function getAllowedGroups(scope) {
  return ALLOWED_GROUPS_BY_SCOPE[scope] || null;
}

function createPersistedRoute({
  scope,
  segments = [],
  params = {},
  savedAt = Date.now(),
} = {}) {
  const allowedGroups = getAllowedGroups(scope);
  if (!allowedGroups || !Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  const normalizedSegments = segments.map((segment) => String(segment || ""));
  const routeGroup = normalizedSegments[0];
  if (!allowedGroups.has(routeGroup)) return null;
  if (
    normalizedSegments.some(
      (segment) => !segment || segment.includes("/") || segment === "..",
    )
  ) {
    return null;
  }

  return {
    version: NAVIGATION_RECORD_VERSION,
    scope,
    pathname: `/${normalizedSegments.join("/")}`,
    params: sanitizeParams(params),
    savedAt,
  };
}

function parsePersistedRoute(raw, { scope, now = Date.now() } = {}) {
  if (!raw || !getAllowedGroups(scope)) return null;

  try {
    const record = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!record || record.version !== NAVIGATION_RECORD_VERSION) return null;
    if (record.scope !== scope) return null;
    if (!Number.isFinite(record.savedAt)) return null;
    if (now - record.savedAt > NAVIGATION_RECORD_MAX_AGE_MS) return null;
    if (record.savedAt - now > 60 * 1000) return null;

    const pathname = String(record.pathname || "");
    const routeGroup = pathname.split("/").filter(Boolean)[0];
    if (!getAllowedGroups(scope).has(routeGroup)) return null;
    if (pathname.includes("/(auth)")) return null;

    return {
      pathname,
      params: sanitizeParams(record.params),
    };
  } catch {
    return null;
  }
}

module.exports = {
  NAVIGATION_RECORD_MAX_AGE_MS,
  NAVIGATION_RECORD_VERSION,
  createPersistedRoute,
  getNavigationScope,
  getNavigationStorageKey,
  parsePersistedRoute,
  sanitizeParams,
};
