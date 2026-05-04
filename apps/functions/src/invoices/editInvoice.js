const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

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
    await invoiceRef.update(updateData);

    // 5. LOG
    await db.collection("invoice_events").add({
      invoiceId,
      type: "INVOICE_UPDATED",
      actorId: uid,
      at: admin.firestore.Timestamp.now(),
      note: "Invoice updated",
    });

    return {
      success: true,
      invoiceId,
    };
  },
);
