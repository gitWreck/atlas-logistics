"use strict";

const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const {
  clearedInvoiceLinkFields,
  shouldClearDeletedInvoiceLink,
} = require("./invoiceLinkCleanup.cjs");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.cleanupDeletedInvoice = onDocumentDeleted(
  {
    document: "invoices/{invoiceId}",
    region: "asia-southeast1",
  },
  async (event) => {
    const deletedInvoice = event.data?.data() || {};
    const invoiceId = String(event.params?.invoiceId || "").trim();
    const shipmentId = String(deletedInvoice.shipmentId || "").trim();

    if (!invoiceId || !shipmentId) return;

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (transaction) => {
      const shipmentSnap = await transaction.get(shipmentRef);
      if (!shipmentSnap.exists) return;

      const shipment = shipmentSnap.data() || {};
      if (!shouldClearDeletedInvoiceLink(shipment, invoiceId)) return;

      transaction.update(shipmentRef, {
        ...clearedInvoiceLinkFields(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: "system:invoice-delete-cleanup",
      });
    });
  },
);
