"use strict";

// Pure helpers shared by the delete trigger and unit tests.
function linkedInvoiceId(shipment = {}) {
  return String(shipment.invoiceId || shipment.invoiceNumber || "").trim();
}

function shouldClearDeletedInvoiceLink(shipment = {}, deletedInvoiceId) {
  const deletedId = String(deletedInvoiceId || "").trim();
  return Boolean(deletedId) && linkedInvoiceId(shipment) === deletedId;
}

function clearedInvoiceLinkFields() {
  return {
    invoiceId: null,
    invoiceNumber: null,
    invoiceStatus: null,
    hasInvoice: false,
  };
}

module.exports = {
  clearedInvoiceLinkFields,
  linkedInvoiceId,
  shouldClearDeletedInvoiceLink,
};
