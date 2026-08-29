"use strict";

const PAID_INVOICE_CORRECTION_ROLES = new Set(["admin", "superadmin"]);

function evaluateInvoiceEdit({
  currentStatus,
  actorRole,
  correctionReason,
  requestedStatus,
} = {}) {
  const status = String(currentStatus || "DRAFT").trim().toUpperCase();
  const role = String(actorRole || "").trim().toLowerCase();
  const reason = String(correctionReason || "").trim().slice(0, 500);
  const nextStatus = String(requestedStatus || status).trim().toUpperCase();

  if (status === "CANCELLED") {
    return {
      allowed: false,
      code: "failed-precondition",
      message: "Cannot edit a cancelled invoice.",
    };
  }

  if (status !== "PAID") {
    return { allowed: true, isPaidCorrection: false, reason: null };
  }

  if (!PAID_INVOICE_CORRECTION_ROLES.has(role)) {
    return {
      allowed: false,
      code: "permission-denied",
      message: "Only an admin can correct a paid invoice.",
    };
  }

  if (nextStatus !== "PAID") {
    return {
      allowed: false,
      code: "failed-precondition",
      message: "A paid-invoice correction cannot change its payment status.",
    };
  }

  if (reason.length < 5) {
    return {
      allowed: false,
      code: "invalid-argument",
      message: "Enter a correction reason with at least 5 characters.",
    };
  }

  return { allowed: true, isPaidCorrection: true, reason };
}

module.exports = {
  PAID_INVOICE_CORRECTION_ROLES,
  evaluateInvoiceEdit,
};
