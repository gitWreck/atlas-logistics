import { resolveShipmentPackageBreakdown } from "@/app/utility/packageStatus";

export const ALL_CHECKERS_TAB = "all";

function normalizeStatus(value = "") {
  return String(value || "").trim().toUpperCase();
}

function pieceQty(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function isExcludedCheckerPiece(pkg = {}) {
  const status = normalizeStatus(pkg.status);
  return ["MISSING", "DAMAGED", "CANCELLED"].includes(status);
}

function isLikelyFirebaseUid(value = "") {
  return /^[a-zA-Z0-9]{20,}$/.test(String(value || "").trim());
}

export function resolveCheckerUid(pkg = {}) {
  const custodyIsChecker = normalizeStatus(pkg.custodyOwnerType) === "CHECKER";
  const custodyId = String(pkg.custodyOwnerId || "").trim();

  return (
    String(pkg.loadedByCheckerId || "").trim() ||
    String(pkg.deliveredByCheckerId || "").trim() ||
    String(pkg.loadedByUid || "").trim() ||
    (custodyIsChecker ? custodyId : "")
  );
}

function resolveCheckerLabel(pkg = {}, checkerNameById = {}) {
  const uid = resolveCheckerUid(pkg);
  const name = String(
    pkg.loadedByCheckerName ||
      pkg.deliveredByCheckerName ||
      pkg.loadedBy ||
      "",
  ).trim();

  if (name && (!uid || name.toLowerCase() !== uid.toLowerCase())) {
    return name;
  }
  if (uid && checkerNameById[uid]) return checkerNameById[uid];
  return name || uid || "Checker";
}

/** Package scanned and loaded by a checker (checker has custody). */
export function isPackageOnChecker(pkg = {}) {
  if (isExcludedCheckerPiece(pkg)) return false;

  if (resolveCheckerUid(pkg)) return true;

  const custody = normalizeStatus(pkg.custodyOwnerType);
  const custodyId = String(pkg.custodyOwnerId || "").trim();
  if (custody === "CHECKER" && custodyId) return true;

  return false;
}

/**
 * Resolve checker identity from package scan/custody fields.
 * Tabs are keyed by checker user id when available; label comes from loadedByCheckerName.
 */
export function getCheckerIdentity(pkg = {}, checkerNameById = {}) {
  const uid = resolveCheckerUid(pkg);
  const custodyIsChecker = normalizeStatus(pkg.custodyOwnerType) === "CHECKER";
  const custodyId = String(pkg.custodyOwnerId || "").trim();
  const label = resolveCheckerLabel(pkg, checkerNameById);

  const key = uid || (custodyIsChecker ? custodyId : "") || label || "unknown";

  return { key, label: label || key || "Checker" };
}

function packageMatchesCheckerKey(
  pkg = {},
  checkerKey = ALL_CHECKERS_TAB,
  checkerNameById = {},
) {
  if (checkerKey === ALL_CHECKERS_TAB) return true;
  return getCheckerIdentity(pkg, checkerNameById).key === checkerKey;
}

function packageMatchesCheckerTab(pkg = {}, tab = null, checkerNameById = {}) {
  if (!tab || tab.key === ALL_CHECKERS_TAB) return true;

  const { key } = getCheckerIdentity(pkg, checkerNameById);
  const matchKeys = Array.isArray(tab.matchKeys) ? tab.matchKeys : [tab.key];
  return matchKeys.includes(key);
}

function addCheckerTabCount(checkerMap, { key, label, qty }) {
  if (!key || qty <= 0) return qty;

  if (!checkerMap.has(key)) {
    checkerMap.set(key, { key, label, count: 0, matchKeys: [key] });
  }

  const row = checkerMap.get(key);
  row.count += qty;
  if (label && (row.label === row.key || !row.label)) {
    row.label = label;
  }

  return qty;
}

function countCheckerPiecesFromPackages(
  shipment = {},
  checkerKey = ALL_CHECKERS_TAB,
  checkerTab = null,
  checkerNameById = {},
) {
  const packages = Array.isArray(shipment?.packages) ? shipment.packages : [];
  let count = 0;

  packages.forEach((pkg) => {
    if (!isPackageOnChecker(pkg)) return;

    if (checkerTab) {
      if (!packageMatchesCheckerTab(pkg, checkerTab, checkerNameById)) return;
    } else if (
      !packageMatchesCheckerKey(pkg, checkerKey, checkerNameById)
    ) {
      return;
    }

    count += pieceQty(pkg);
  });

  return count;
}

function countShipmentCheckerPoolPieces(shipment = {}) {
  const breakdown = resolveShipmentPackageBreakdown(shipment);
  return (
    Number(breakdown.outForDelivery || 0) + Number(breakdown.onCheckerVan || 0)
  );
}

/**
 * When piece rows are missing checker ids but shipment.activeCheckerIds and
 * packageBreakdown show last-mile inventory, attribute the remainder to the
 * sole active checker on that shipment.
 */
function countCheckerFallbackPieces(
  shipment = {},
  checkerKey = ALL_CHECKERS_TAB,
  checkerNameById = {},
) {
  const packageCount = countCheckerPiecesFromPackages(
    shipment,
    ALL_CHECKERS_TAB,
    null,
    checkerNameById,
  );
  const poolCount = countShipmentCheckerPoolPieces(shipment);
  const remainder = Math.max(poolCount - packageCount, 0);
  if (remainder <= 0) return 0;

  const activeIds = (Array.isArray(shipment.activeCheckerIds)
    ? shipment.activeCheckerIds
    : []
  )
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  if (activeIds.length !== 1) return 0;
  if (checkerKey !== ALL_CHECKERS_TAB && activeIds[0] !== checkerKey) {
    return 0;
  }

  return remainder;
}

/**
 * Older packages sometimes stored the checker display name as the id
 * (e.g. loadedByCheckerId = "Cha") while newer scans use the Firebase uid.
 * Merge those into one tab when the label clearly refers to the same person.
 */
function mergeCheckerTabsByLabel(tabs = []) {
  const merged = [];

  tabs.forEach((tab) => {
    const labelNorm = String(tab.label || "").trim().toLowerCase();
    const existing = merged.find((candidate) => {
      if (candidate.label.trim().toLowerCase() !== labelNorm) return false;
      if (candidate.key === tab.key) return true;

      const existingKeys = new Set(candidate.matchKeys || [candidate.key]);
      const tabKeys = new Set(tab.matchKeys || [tab.key]);
      const sharesKey = [...existingKeys].some((key) => tabKeys.has(key));
      if (sharesKey) return true;

      const existingHasUid = [...existingKeys].some(isLikelyFirebaseUid);
      const tabHasUid = [...tabKeys].some(isLikelyFirebaseUid);
      const existingHasNameKey = [...existingKeys].some(
        (key) => key.trim().toLowerCase() === labelNorm,
      );
      const tabHasNameKey = [...tabKeys].some(
        (key) => key.trim().toLowerCase() === labelNorm,
      );

      return (
        (existingHasUid && tabHasNameKey) || (tabHasUid && existingHasNameKey)
      );
    });

    if (!existing) {
      merged.push({
        ...tab,
        matchKeys: [...new Set(tab.matchKeys || [tab.key])],
      });
      return;
    }

    existing.count += tab.count;
    existing.matchKeys = [
      ...new Set([
        ...(existing.matchKeys || [existing.key]),
        ...(tab.matchKeys || [tab.key]),
      ]),
    ];

    const canonicalKey = existing.matchKeys.find(isLikelyFirebaseUid);
    if (canonicalKey) {
      existing.key = canonicalKey;
    }
  });

  return merged;
}

export function countCheckerPiecesInShipment(
  shipment = {},
  checkerKey = ALL_CHECKERS_TAB,
  checkerTab = null,
  checkerNameById = {},
) {
  return (
    countCheckerPiecesFromPackages(
      shipment,
      checkerKey,
      checkerTab,
      checkerNameById,
    ) +
    countCheckerFallbackPieces(shipment, checkerKey, checkerNameById)
  );
}

export function shipmentHasCheckerPieces(
  shipment = {},
  checkerKey = ALL_CHECKERS_TAB,
  checkerTab = null,
  checkerNameById = {},
) {
  return (
    countCheckerPiecesInShipment(
      shipment,
      checkerKey,
      checkerTab,
      checkerNameById,
    ) > 0
  );
}

export function buildDeliveryCheckerTabs(
  shipments = [],
  checkerNameById = {},
) {
  const checkerMap = new Map();
  let totalCount = 0;

  shipments.forEach((shipment) => {
    const packages = Array.isArray(shipment?.packages) ? shipment.packages : [];

    packages.forEach((pkg) => {
      if (!isPackageOnChecker(pkg)) return;

      const { key, label } = getCheckerIdentity(pkg, checkerNameById);
      const qty = pieceQty(pkg);
      totalCount += addCheckerTabCount(checkerMap, { key, label, qty });
    });

    const fallbackQty = Math.max(
      countCheckerFallbackPieces(shipment, ALL_CHECKERS_TAB, checkerNameById),
      0,
    );
    if (fallbackQty > 0) {
      const activeId = String(shipment.activeCheckerIds[0] || "").trim();
      const label =
        checkerNameById[activeId] ||
        String(shipment.assignedCheckerName || "").trim() ||
        activeId ||
        "Checker";
      totalCount += addCheckerTabCount(checkerMap, {
        key: activeId,
        label,
        qty: fallbackQty,
      });
    }
  });

  const checkerTabs = mergeCheckerTabsByLabel([...checkerMap.values()]).sort(
    (a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    },
  );

  return [
    { key: ALL_CHECKERS_TAB, label: "All Checkers", count: totalCount },
    ...checkerTabs,
  ];
}

export function findDeliveryCheckerTab(tabs = [], checkerKey = ALL_CHECKERS_TAB) {
  if (checkerKey === ALL_CHECKERS_TAB) {
    return tabs.find((tab) => tab.key === ALL_CHECKERS_TAB) || null;
  }

  return (
    tabs.find(
      (tab) =>
        tab.key === checkerKey ||
        (Array.isArray(tab.matchKeys) && tab.matchKeys.includes(checkerKey)),
    ) || null
  );
}
