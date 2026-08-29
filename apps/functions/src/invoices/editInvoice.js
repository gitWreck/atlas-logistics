const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  getActorFromRequest,
  writeInvoiceActionLog,
} = require("../utilities/invoiceLogger");
const { updatedBy } = require("../utilities/helpers");
const { evaluateInvoiceEdit } = require("./invoiceEditPolicy.cjs");

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

    // const uid = request.auth.uid;
    // const actor = getActorFromRequest(request);

    const {
      invoiceId,
      invoiceDate,
      dueDate,
      billingName,
      billingAddress,
      senderName,
      amount,
      notes,
      status,
      correctionReason,
    } = request.data || {};

    const requestActor = updatedBy(request);
    const { uid } = requestActor;

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

    if (
      invoiceData.sourceReadOnly === true ||
      String(invoiceData.sourceSystem || "").toLowerCase() === "atlas-finance"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Atlas Finance invoices are read-only in Atlas Transport.",
      );
    }

    const currentStatus = String(invoiceData.status || "DRAFT").toUpperCase();
    let trustedUserData = {};
    if (currentStatus === "PAID") {
      const userDoc = await db.collection("users").doc(uid).get();
      trustedUserData = userDoc.exists ? userDoc.data() || {} : {};
    }

    const actor = getActorFromRequest(request, trustedUserData);
    const editPolicy = evaluateInvoiceEdit({
      currentStatus,
      actorRole:
        trustedUserData.role || request.auth?.token?.role,
      correctionReason,
      requestedStatus: status,
    });
    if (!editPolicy.allowed) {
      throw new HttpsError(editPolicy.code, editPolicy.message);
    }

    const actorName = actor.actorName || requestActor.name || "Unknown user";
    const actorRole = actor.actorRole || requestActor.role || "unknown";

    // 3. BUILD UPDATE OBJECT
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorName,
    };

    if (invoiceDate !== undefined) updateData.invoiceDate = invoiceDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (billingName !== undefined) updateData.billingName = billingName;
    if (billingAddress !== undefined)
      updateData.billingAddress = billingAddress;
    if (senderName !== undefined) {
      updateData.senderName =
        String(senderName || "").trim().slice(0, 500) || "Unknown Sender";
    }
    if (amount !== undefined) {
      const nextAmount = Number(amount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        throw new HttpsError(
          "invalid-argument",
          "Invoice amount must be a valid non-negative number.",
        );
      }
      updateData.amount = nextAmount;
    }
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    // 4. WRITE
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const changedFields = Object.keys(updateData).filter(
      (field) => field !== "updatedAt" && field !== "updatedBy",
    );

    batch.update(invoiceRef, updateData);

    const eventType = editPolicy.isPaidCorrection
      ? "PAID_INVOICE_CORRECTED"
      : "INVOICE_UPDATED";
    batch.set(db.collection("invoice_events").doc(), {
      invoiceId,
      invoiceNumber: invoiceData.invoiceNumber || invoiceId,
      shipmentId: invoiceData.shipmentId || null,
      tripId: invoiceData.tripId || invoiceData.truckTripId || null,
      type: eventType,
      actorId: uid,
      at: admin.firestore.Timestamp.now(),
      note: editPolicy.isPaidCorrection
        ? `Paid invoice corrected: ${editPolicy.reason}`
        : "Invoice updated",
      ...(editPolicy.isPaidCorrection
        ? {
            correctionReason: editPolicy.reason,
            previousAmount: Number(invoiceData.amount || 0),
            amount: Number(updateData.amount ?? invoiceData.amount ?? 0),
            previousStatus: currentStatus,
            status: "PAID",
          }
        : {}),
    });

    writeInvoiceActionLog({
      db,
      batch,
      action: editPolicy.isPaidCorrection
        ? "CORRECT_PAID_INVOICE"
        : "UPDATE_INVOICE",
      invoiceId,
      invoiceDocId: invoiceRef.id,
      invoiceNumber: invoiceData.invoiceNumber || invoiceId,
      shipmentId: invoiceData.shipmentId || null,
      actorId: uid,
      actorName,
      actorRole,
      details: {
        changedFields,
        status: updateData.status,
        ...(editPolicy.isPaidCorrection
          ? {
              correctionReason: editPolicy.reason,
              previousAmount: Number(invoiceData.amount || 0),
              amount: Number(updateData.amount ?? invoiceData.amount ?? 0),
              previousBillingName: invoiceData.billingName || null,
              billingName: updateData.billingName ?? invoiceData.billingName ?? null,
              previousSenderName: invoiceData.senderName || null,
              senderName: updateData.senderName ?? invoiceData.senderName ?? null,
            }
          : {}),
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
