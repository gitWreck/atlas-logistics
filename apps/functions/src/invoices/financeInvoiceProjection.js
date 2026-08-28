"use strict";

const crypto = require("node:crypto");

const FINANCE_STATUS_MAP = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "DRAFT",
  APPROVED: "DRAFT",
  SENT: "ISSUED",
  PAID: "PAID",
  VOIDED: "CANCELLED",
});

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function financeProjectionKey(sourceFinanceInvoiceId, shipmentId) {
  const invoiceId = clean(sourceFinanceInvoiceId, 250);
  const sourceShipmentId = clean(shipmentId, 250);
  if (!invoiceId || !sourceShipmentId) return "";
  return `${invoiceId}:${sourceShipmentId}`;
}

function financeProjectionDocumentId(sourceFinanceInvoiceId, shipmentId) {
  const key = financeProjectionKey(sourceFinanceInvoiceId, shipmentId);
  if (!key) return "";
  return `FIN-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 28)}`;
}

function mapFinanceInvoiceStatus(status) {
  return FINANCE_STATUS_MAP[clean(status, 40).toUpperCase()] || "DRAFT";
}

function centsToPesos(centavos) {
  const value = Number(centavos);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value / 100;
}

module.exports = {
  FINANCE_STATUS_MAP,
  centsToPesos,
  clean,
  financeProjectionDocumentId,
  financeProjectionKey,
  mapFinanceInvoiceStatus,
};
