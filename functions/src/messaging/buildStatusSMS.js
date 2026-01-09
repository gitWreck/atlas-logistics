"use strict";

/**
 * ======================================================
 * ATLAS — CANONICAL SMS BUILDER (Option B)
 * Single source of truth
 * Status-driven • Delay-aware • Credit-safe
 * Versioned for audit integrity
 * ======================================================
 */

const { DELAY_REASONS } = require("./../../shared/delay-reasons.js");

const SMS_VERSION = "v1.2";

/* ======================================================
   HELPERS
====================================================== */
function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function sentenceCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ======================================================
   STATUS SENTENCES (CANONICAL)
====================================================== */
function statusSentence(rawStatus = "") {
  const status = normalizeStatus(rawStatus);

  switch (status) {
    case "received":
      return "Your shipment has been received at our warehouse.";
    case "loaded":
      return "Your shipment has been loaded onto the truck.";
    case "in transit":
      return "Your shipment is in transit.";
    case "arrived at port":
      return "Your shipment has arrived at the port.";
    case "boarded roro vessel":
      return "Your shipment is now in transit via RORO vessel.";
    case "out for delivery":
      return "Your shipment is out for delivery.";
    case "delivered":
      return "Your shipment has been delivered.";
    default:
      return `Your shipment status is updated: ${sentenceCase(status)}.`;
  }
}

/* ======================================================
   MAIN BUILDER (PURE FUNCTION)
====================================================== */
function buildStatusSMS({
  trackingId,
  status,
  delayReason = null,
  delayCleared = false,

  // Optional flags
  mode = "full", // "full" | "short"
  includeBrand = true,
}) {
  if (!status) {
    throw new Error("buildStatusSMS: status is required");
  }

  const ref = String(trackingId || "—").trim();
  const delayKey = delayReason
    ? String(delayReason).trim().toUpperCase()
    : null;

  const lines = [];

  /* ---------- HEADER ---------- */
  if (includeBrand) {
    lines.push("ATLAS:");
  }

  /* ---------- STATUS ---------- */
  lines.push(statusSentence(status));

  /* ---------- TRACKING ---------- */
  if (mode !== "short" && ref !== "—") {
    lines.push(`Tracking: ${ref}`);
  }

  /* ---------- DELAY LOGIC ---------- */
  if (!delayCleared && delayKey && DELAY_REASONS[delayKey]) {
    lines.push(`⚠ Delay: ${DELAY_REASONS[delayKey]}.`);

    if (mode !== "short") {
      lines.push("We will update you once operations resume.");
    }
  }

  if (delayCleared) {
    lines.push("✅ Delay cleared. Operations have resumed.");
  }

  /* ---------- FOOTER ---------- */
  if (mode !== "short") {
    lines.push(`Ref: ${SMS_VERSION}`);
  }

  return lines.join("\n").trim();
}

/* ======================================================
   EXPORT (IMMUTABLE)
====================================================== */
module.exports = Object.freeze({
  buildStatusSMS,
});
