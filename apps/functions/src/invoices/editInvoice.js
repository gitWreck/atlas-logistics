const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  getActorFromRequest,
  writeInvoiceActionLog,
} = require("../utilities/invoiceLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.editInvoice = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    // 1. AUTH
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;
    const actor = getActorFromRequest(request);

    const {
      invoiceId,
      invoiceDate,
      dueDate,
      billingName,
      billingAddress,
      amount,
      notes,
      status,
    } = request.data || {};

    // 2. VALIDATION
    if (!invoiceId) {
      throw new HttpsError("invalid-argument", "Missing invoiceId.");
    }

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();

    if (!invoiceDoc.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoiceData = invoiceDoc.data();

    // Optional: prevent editing if already paid/cancelled
    if (["PAID", "CANCELLED"].includes(invoiceData.status)) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot edit finalized invoice.",
      );
    }

    // 3. BUILD UPDATE OBJECT
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    };

    if (invoiceDate !== undefined) updateData.invoiceDate = invoiceDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (billingName !== undefined) updateData.billingName = billingName;
    if (billingAddress !== undefined)
      updateData.billingAddress = billingAddress;
    if (amount !== undefined && !isNaN(Number(amount)))
      updateData.amount = Number(amount);
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    // 4. WRITE
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const changedFields = Object.keys(updateData).filter(
      (field) => field !== "updatedAt" && field !== "updatedBy",
    );

    batch.update(invoiceRef, updateData);

    batch.set(db.collection("invoice_events").doc(), {
      invoiceId,
      type: "INVOICE_UPDATED",
      actorId: uid,
      at: admin.firestore.Timestamp.now(),
      note: "Invoice updated",
    });

    writeInvoiceActionLog({
      db,
      batch,
      action: "UPDATE_INVOICE",
      invoiceId,
      invoiceDocId: invoiceRef.id,
      invoiceNumber: invoiceData.invoiceNumber || invoiceId,
      shipmentId: invoiceData.shipmentId || null,
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      details: {
        changedFields,
        status: updateData.status,
      },
      createdAt: nowAt,
    });

    await batch.commit();

    return {
      success: true,
      invoiceId,
    };
  },
);
