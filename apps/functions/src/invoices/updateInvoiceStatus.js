const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  getActorFromRequest,
  writeInvoiceActionLog,
} = require("../utilities/invoiceLogger");
let sendInvoicesStatusSmsLogic = null;
try {
  ({
    sendInvoicesStatusSmsLogic,
  } = require("../messaging/sendInvoicesStatusSmsLogic"));
} catch (error) {
  console.warn(
    "[INVOICE_SMS] sendInvoicesStatusSmsLogic unavailable; invoice SMS notifications disabled.",
  );
}
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const {
  INVOICES_ALLOWED_STATUSES,
  INVOICES_VALID_TRANSITIONS,
} = require("../utilities/dataDetails");

exports.updateInvoiceStatus = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;
    const {
      invoiceId,
      status,
      sendNotification = false,
      customMessage = "",
    } = request.data || {};

    if (!invoiceId || !status) {
      throw new HttpsError("invalid-argument", "Missing invoiceId or status.");
    }

    if (!INVOICES_ALLOWED_STATUSES.includes(status)) {
      throw new HttpsError("invalid-argument", "Invalid invoice status.");
    }

    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const actor = getActorFromRequest(request, userData || {});

    if (
      !userData ||
      !["admin", "manager", "checker"].includes(
        String(userData.role || "").toLowerCase(),
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "Only admin, manager, or checker can update invoice status.",
      );
    }

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();

    if (!invoiceDoc.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoiceData = invoiceDoc.data() || {};
    const currentStatus = invoiceData.status || "DRAFT";

    const allowedNextStatuses = INVOICES_VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(status)) {
      throw new HttpsError(
        "failed-precondition",
        `Invalid status transition from ${currentStatus} to ${status}.`,
      );
    }

    const shipmentId = invoiceData.shipmentId || null;
    let shipmentRef = null;
    let shipmentData = null;

    if (shipmentId) {
      shipmentRef = db.collection("shipments").doc(shipmentId);
      const shipmentDoc = await shipmentRef.get();
      if (shipmentDoc.exists) {
        shipmentData = shipmentDoc.data() || {};
      }
    }

    const now = admin.firestore.Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.update(invoiceRef, {
      status,
      updatedAt: nowAt,
      updatedBy: uid,
    });

    if (shipmentRef) {
      if (status === "CANCELLED") {
        const linkedInvoiceId = shipmentData?.invoiceId || null;

        if (!linkedInvoiceId || linkedInvoiceId === invoiceId) {
          batch.set(
            shipmentRef,
            {
              invoiceId: null,
              invoiceNumber: null,
              invoiceStatus: "CANCELLED",
              hasInvoice: false,
              updatedAt: nowAt,
              updatedBy: uid,
            },
            { merge: true },
          );
        }
      } else {
        batch.set(
          shipmentRef,
          {
            invoiceId,
            invoiceNumber: invoiceData.invoiceNumber || invoiceId,
            invoiceStatus: status,
            hasInvoice: true,
            updatedAt: nowAt,
            updatedBy: uid,
          },
          { merge: true },
        );
      }
    }

    batch.set(db.collection("invoice_events").doc(), {
      invoiceId,
      invoiceNumber: invoiceData.invoiceNumber || invoiceId,
      shipmentId: shipmentId || null,
      type: "STATUS_UPDATED",
      previousStatus: currentStatus,
      status,
      actorId: uid,
      at: now,
      note: `Invoice ${invoiceData.invoiceNumber || invoiceId} updated from ${currentStatus} to ${status}`,
    });

    writeInvoiceActionLog({
      db,
      batch,
      action: "UPDATE_INVOICE_STATUS",
      invoiceId,
      invoiceDocId: invoiceRef.id,
      invoiceNumber: invoiceData.invoiceNumber || invoiceId,
      shipmentId: shipmentId || null,
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      details: {
        previousStatus: currentStatus,
        status,
        sendNotification: Boolean(sendNotification),
      },
      createdAt: nowAt,
    });

    try {
      await batch.commit();

      if (sendNotification === true && sendInvoicesStatusSmsLogic) {
        sendInvoicesStatusSmsLogic({
          invoiceId: invoiceData.invoiceNumber || invoiceId,
          shipmentId: shipmentId || null,
          senderPhone:
            invoiceData.senderPhone || shipmentData?.sender?.phone || null,
          recipientPhone:
            invoiceData.recipientPhone ||
            shipmentData?.recipient?.phone ||
            null,
          status,
          billingName: invoiceData.billingName || null,
          origin: invoiceData.origin || shipmentData?.origin || null,
          destination:
            invoiceData.destination || shipmentData?.destination || null,
          actorUid: uid,
          customMessage,
        }).catch((err) =>
          console.error("[SMS_ERROR] Invoice status notification failed:", err),
        );
      }

      return {
        success: true,
        invoiceId,
        status,
        previousStatus: currentStatus,
        notificationRequested: Boolean(sendNotification),
      };
    } catch (error) {
      console.error("Invoice status update failed:", error);
      throw new HttpsError("internal", "Failed to update invoice status.");
    }
  },
);
