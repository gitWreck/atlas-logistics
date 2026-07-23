"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

/**
 * Backend enforcement for role-based customer communication (voice / video /
 * chat / cell-phone number retrieval).
 *
 * Mirrors the mobile custody rules in
 * apps/mobile/components/utilities/checkerDeliveryPool.js and checkerDelivery.js
 * so the UI and the server agree on exactly one "responsible owner" per
 * shipment (see spec sections 7, 8, 11, 12, 14, 17).
 *
 * Permission model:
 *   - Admin / Manager  -> may communicate with any customer (no restrictions).
 *   - Driver           -> may NEVER communicate with customers.
 *   - Checker          -> while the shipment is in their custody and they hold
 *                         OUT_FOR_DELIVERY or FAILED_DELIVERY pieces (spec §14).
 *   - Customer         -> may reach the current responsible owner only.
 */

const ADMIN_ROLES = ["admin", "administrator"];
const MANAGER_ROLES = ["manager"];

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeId(value) {
  return String(value || "").trim();
}

/** Shipment-level statuses that permanently end customer communication. */
const TERMINAL_SHIPMENT_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
]);

/** Piece-level statuses that no longer count as an active checker delivery. */
const CLOSED_PIECE_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "MISSING",
  "DAMAGED",
  "CANCELLED",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
]);

/**
 * Piece statuses where the assigned checker still owns customer communication
 * (spec §14: Loaded/Out for Delivery AND Failed Delivery).
 */
const CHECKER_COMMS_PIECE_STATUSES = new Set([
  "OUT_FOR_DELIVERY",
  "FAILED_DELIVERY",
]);

function pieceQuantity(pkg = {}) {
  const qty = Number(pkg.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

/** Piece currently owned by this checker (loaded by them or CHECKER custody). */
function isCheckerCustodyPiece(pkg = {}, checkerUid) {
  const uid = normalizeId(checkerUid);
  if (!uid) return false;
  if (normalizeId(pkg.loadedByCheckerId) === uid) return true;
  return (
    normalizeStatus(pkg.custodyOwnerType) === "CHECKER" &&
    normalizeId(pkg.custodyOwnerId) === uid
  );
}

/**
 * Count of this checker's pieces that still authorize customer contact:
 * OUT_FOR_DELIVERY or FAILED_DELIVERY in their custody (spec §8 + §14).
 */
function countCheckerActiveDeliveryPieces(shipment = {}, checkerUid) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  let count = 0;

  packages.forEach((pkg) => {
    if (!isCheckerCustodyPiece(pkg, checkerUid)) return;
    const status = normalizeStatus(pkg.status);
    if (CLOSED_PIECE_STATUSES.has(status)) return;
    if (CHECKER_COMMS_PIECE_STATUSES.has(status)) {
      count += pieceQuantity(pkg);
    }
  });

  return count;
}

/**
 * Piece IDs currently authorizing customer contact for this checker.
 * Used to stamp the communication log (spec section 18).
 */
function getCheckerActivePieceIds(shipment = {}, checkerUid) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const ids = [];
  packages.forEach((pkg) => {
    if (!isCheckerCustodyPiece(pkg, checkerUid)) return;
    if (!CHECKER_COMMS_PIECE_STATUSES.has(normalizeStatus(pkg.status))) return;
    const id =
      pkg.id || pkg.packageId || pkg.pieceId || pkg.barcode || pkg.label;
    if (id) ids.push(String(id));
  });
  return ids;
}

/** Checker is the assigned delivery owner (assignee or loaded a piece). */
function checkerIsAssigned(shipment = {}, checkerUid) {
  const uid = normalizeId(checkerUid);
  if (!uid) return false;
  if (normalizeId(shipment.assignedCheckerId) === uid) return true;
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  return packages.some((pkg) => normalizeId(pkg.loadedByCheckerId) === uid);
}

/**
 * Whether a checker may communicate with the customer for this shipment.
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function evaluateCheckerCustomerComms(shipment = {}, checkerUid) {
  if (!shipment || !normalizeId(checkerUid)) {
    return { allowed: false, reason: "Shipment or checker missing." };
  }

  const status = normalizeStatus(shipment.status);
  if (TERMINAL_SHIPMENT_STATUSES.has(status)) {
    return { allowed: false, reason: "Shipment is no longer active for delivery." };
  }

  if (!checkerIsAssigned(shipment, checkerUid)) {
    return { allowed: false, reason: "Shipment is not assigned to this checker." };
  }

  const activePieces = countCheckerActiveDeliveryPieces(shipment, checkerUid);
  if (activePieces <= 0) {
    return {
      allowed: false,
      reason:
        "No out-for-delivery or failed-delivery pieces in this checker's custody.",
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Assert that the actor may start customer communication for a shipment.
 * Throws HttpsError("permission-denied", "403 Permission Denied") when not.
 *
 * @param {object} params
 * @param {string} params.uid            Authenticated actor uid.
 * @param {string} params.role           Lowercased actor role.
 * @param {object} params.shipment       Shipment document data.
 * @param {string} [params.customerId]   The customer's uid (for customer callers).
 * @returns {{ owner: "admin"|"manager"|"checker"|"customer" }}
 */
function assertCustomerCommsAllowed({ uid, role, shipment, customerId } = {}) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (ADMIN_ROLES.includes(normalizedRole)) {
    return { owner: "admin" };
  }
  if (MANAGER_ROLES.includes(normalizedRole)) {
    return { owner: "manager" };
  }

  if (normalizedRole === "driver") {
    throw new HttpsError("permission-denied", "403 Permission Denied");
  }

  if (normalizedRole === "checker") {
    if (!shipment) {
      throw new HttpsError("permission-denied", "403 Permission Denied");
    }
    const { allowed } = evaluateCheckerCustomerComms(shipment, uid);
    if (!allowed) {
      throw new HttpsError("permission-denied", "403 Permission Denied");
    }
    return { owner: "checker" };
  }

  if (normalizedRole === "customer") {
    // A customer may only reach the current responsible owner. The caller
    // resolves who that is; here we just confirm the customer owns the thread.
    if (customerId && normalizeId(customerId) === normalizeId(uid)) {
      return { owner: "customer" };
    }
    throw new HttpsError("permission-denied", "403 Permission Denied");
  }

  throw new HttpsError("permission-denied", "403 Permission Denied");
}

/**
 * Resolve the current customer-communication owner for a shipment
 * (spec section 14 responsibility workflow). Used to route customer-initiated
 * contact to the right employee.
 * @returns {{ ownerType: "checker"|"warehouse", checkerId: string|null }}
 */
function resolveShipmentCommsOwner(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const status = normalizeStatus(shipment.status);

  if (!TERMINAL_SHIPMENT_STATUSES.has(status)) {
    // Prefer OFD pieces, then Failed Delivery (spec §14).
    for (const preferred of ["OUT_FOR_DELIVERY", "FAILED_DELIVERY"]) {
      for (const pkg of packages) {
        const pkgStatus = normalizeStatus(pkg.status);
        if (pkgStatus !== preferred) continue;
        if (CLOSED_PIECE_STATUSES.has(pkgStatus)) continue;
        const checkerId =
          normalizeId(pkg.custodyOwnerType) === "CHECKER"
            ? normalizeId(pkg.custodyOwnerId)
            : normalizeId(pkg.loadedByCheckerId);
        if (checkerId) {
          return { ownerType: "checker", checkerId };
        }
      }
    }
  }

  return { ownerType: "warehouse", checkerId: null };
}

module.exports = {
  assertCustomerCommsAllowed,
  evaluateCheckerCustomerComms,
  resolveShipmentCommsOwner,
  countCheckerActiveDeliveryPieces,
  getCheckerActivePieceIds,
  checkerIsAssigned,
  isCheckerCustodyPiece,
  TERMINAL_SHIPMENT_STATUSES,
};
