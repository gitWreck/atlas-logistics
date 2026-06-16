// Delivery Operations checker tabs — disabled for now (see ShipmentBoard.jsx).

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

/** Package scanned and loaded by a checker (checker has custody). */
export function isPackageOnChecker(pkg = {}) {
  if (isExcludedCheckerPiece(pkg)) return false;

  const loadedBy = String(pkg.loadedByCheckerId || "").trim();
  if (loadedBy) return true;

  const custody = normalizeStatus(pkg.custodyOwnerType);
  const custodyId = String(pkg.custodyOwnerId || "").trim();
  return custody === "CHECKER" && Boolean(custodyId);
}

/**
 * Resolve checker identity from package scan/custody fields.
 * Tabs are keyed by checker user id when available; label comes from loadedByCheckerName.
 */
export function getCheckerIdentity(pkg = {}) {
  const loadedById = String(pkg.loadedByCheckerId || "").trim();
  const custodyId = String(pkg.custodyOwnerId || "").trim();
  const name = String(pkg.loadedByCheckerName || "").trim();
  const custodyIsChecker = normalizeStatus(pkg.custodyOwnerType) === "CHECKER";

  const key =
    loadedById ||
    (custodyIsChecker ? custodyId : "") ||
    name ||
    "unknown";

  const label = name || loadedById || custodyId || "Checker";

  return { key, label };
}

function packageMatchesCheckerKey(pkg = {}, checkerKey = ALL_CHECKERS_TAB) {
  if (checkerKey === ALL_CHECKERS_TAB) return true;
  return getCheckerIdentity(pkg).key === checkerKey;
}

function packageMatchesCheckerTab(pkg = {}, tab = null) {
  if (!tab || tab.key === ALL_CHECKERS_TAB) return true;

  const { key } = getCheckerIdentity(pkg);
  const matchKeys = Array.isArray(tab.matchKeys) ? tab.matchKeys : [tab.key];
  return matchKeys.includes(key);
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
) {
  const packages = Array.isArray(shipment?.packages) ? shipment.packages : [];
  let count = 0;

  packages.forEach((pkg) => {
    if (!isPackageOnChecker(pkg)) return;

    if (checkerTab) {
      if (!packageMatchesCheckerTab(pkg, checkerTab)) return;
    } else if (!packageMatchesCheckerKey(pkg, checkerKey)) {
      return;
    }

    count += pieceQty(pkg);
  });

  return count;
}

export function shipmentHasCheckerPieces(
  shipment = {},
  checkerKey = ALL_CHECKERS_TAB,
  checkerTab = null,
) {
  return countCheckerPiecesInShipment(shipment, checkerKey, checkerTab) > 0;
}

export function buildDeliveryCheckerTabs(shipments = []) {
  const checkerMap = new Map();
  let totalCount = 0;

  shipments.forEach((shipment) => {
    const packages = Array.isArray(shipment?.packages) ? shipment.packages : [];

    packages.forEach((pkg) => {
      if (!isPackageOnChecker(pkg)) return;

      const { key, label } = getCheckerIdentity(pkg);
      const qty = pieceQty(pkg);
      totalCount += qty;

      if (!checkerMap.has(key)) {
        checkerMap.set(key, { key, label, count: 0, matchKeys: [key] });
      }

      const row = checkerMap.get(key);
      row.count += qty;
      if (label && row.label === row.key) {
        row.label = label;
      }
    });
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
