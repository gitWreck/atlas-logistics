"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { canAccessRecord, isActiveProfile } = require("../manager/managerAccess");
const { writeInvoiceActionLog } = require("../utilities/invoiceLogger");
const {
  centsToPesos,
  clean,
  financeProjectionDocumentId,
  financeProjectionKey,
  mapFinanceInvoiceStatus,
} = require("./financeInvoiceProjection");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function dateText(value) {
  const text = clean(value, 40);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw new HttpsError("invalid-argument", "Invoice date is invalid.");
  }
  return text;
}

function sourceTripIdFor(shipment, requestedTripId) {
  const requested = clean(requestedTripId, 250);
  const assigned = [
    clean(shipment.currentTripId, 250),
    ...(Array.isArray(shipment.currentTripIds)
      ? shipment.currentTripIds.map((value) => clean(value, 250))
      : []),
  ].filter(Boolean);
  if (requested && assigned.length && !assigned.includes(requested)) {
    throw new HttpsError(
      "failed-precondition",
      "The Finance invoice trip does not match the shipment's Transport trip.",
    );
  }
  return requested || assigned[0] || null;
}

exports.upsertFinanceInvoice = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const actorSnapshot = await db.collection("users").doc(request.auth.uid).get();
    const actor = actorSnapshot.exists ? actorSnapshot.data() || {} : {};
    const actorRole = clean(actor.role, 80).toLowerCase();
    if (
      !["admin", "administrator", "manager"].includes(actorRole) ||
      !isActiveProfile(actor)
    ) {
      throw new HttpsError(
        "permission-denied",
        "An active Transport Admin or Manager account is required.",
      );
    }

    const data = request.data || {};
    const sourceFinanceInvoiceId = clean(data.sourceFinanceInvoiceId, 250);
    const sourceFinanceInvoiceNumber = clean(
      data.sourceFinanceInvoiceNumber || data.invoiceNumber,
      250,
    );
    const shipmentId = clean(data.shipmentId, 250);
    const projectionKey = financeProjectionKey(sourceFinanceInvoiceId, shipmentId);
    const invoiceId = financeProjectionDocumentId(sourceFinanceInvoiceId, shipmentId);
    const amount = centsToPesos(data.amountCentavos);
    const amountCentavos = Number(data.amountCentavos);
    const status = mapFinanceInvoiceStatus(data.status);

    if (!projectionKey || !invoiceId) {
      throw new HttpsError(
        "invalid-argument",
        "Finance invoice ID and shipment ID are required.",
      );
    }
    if (!sourceFinanceInvoiceNumber) {
      throw new HttpsError("invalid-argument", "Finance invoice number is required.");
    }
    if (amount === null) {
      throw new HttpsError(
        "invalid-argument",
        "Invoice amount must be a non-negative integer number of centavos.",
      );
    }

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const now = admin.firestore.Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    const result = await db.runTransaction(async (transaction) => {
      const [shipmentSnapshot, invoiceSnapshot, shipmentInvoiceSnapshot] =
        await Promise.all([
          transaction.get(shipmentRef),
          transaction.get(invoiceRef),
          transaction.get(
            db.collection("invoices").where("shipmentId", "==", shipmentId),
          ),
        ]);

      if (!shipmentSnapshot.exists) {
        throw new HttpsError("not-found", "Transport shipment not found.");
      }
      const shipment = shipmentSnapshot.data() || {};
      if (actorRole === "manager" && !canAccessRecord(actor, shipment)) {
        throw new HttpsError(
          "permission-denied",
          "This shipment is outside the Manager's assigned scope.",
        );
      }

      const conflictingInvoice = shipmentInvoiceSnapshot.docs.find((document) => {
        if (document.id === invoiceId) return false;
        const invoice = document.data() || {};
        return (
          String(invoice.status || "DRAFT").toUpperCase() !== "CANCELLED" &&
          clean(invoice.sourceFinanceInvoiceKey, 600) !== projectionKey
        );
      });
      if (conflictingInvoice) {
        throw new HttpsError(
          "already-exists",
          "This shipment already has an active Transport invoice.",
        );
      }

      const tripId = sourceTripIdFor(shipment, data.sourceTripId);
      const sender = shipment.sender || null;
      const recipient = shipment.recipient || null;
      const origin = clean(shipment.origin, 500) || null;
      const destination = clean(shipment.destination, 500) || null;
      const invoiceDate = dateText(data.invoiceDate);
      const dueDate = dateText(data.dueDate);
      const created = !invoiceSnapshot.exists;
      const invoiceRecord = {
        invoiceNumber: sourceFinanceInvoiceNumber,
        financeInvoiceNumber: sourceFinanceInvoiceNumber,
        shipmentId,
        shipmentTrackingNumber:
          clean(shipment.trackingNumber || shipment.shipmentId || shipmentId, 250),
        billingName:
          clean(data.billingName || sender?.name, 500) || "Atlas Finance customer",
        billingAddress: clean(data.billingAddress, 1000) || null,
        senderName: clean(sender?.name, 500) || null,
        senderPhone: clean(sender?.phone, 100) || null,
        recipientName: clean(recipient?.name, 500) || null,
        recipientPhone: clean(recipient?.phone, 100) || null,
        origin,
        destination,
        routeLabel:
          origin || destination
            ? `${origin || "Unknown"} -> ${destination || "Unknown"}`
            : null,
        shipmentStatus: clean(shipment.status, 100) || null,
        tripId,
        totalPackages: Array.isArray(shipment.packages)
          ? shipment.packages.length
          : 0,
        totalItems: Number(shipment.totals?.totalItems) || 0,
        amount,
        amountCentavos,
        notes: clean(data.notes, 2000) || "",
        status,
        invoiceDate,
        dueDate,
        sourceSystem: "atlas-finance",
        sourceReadOnly: true,
        sourceFinanceInvoiceId,
        sourceFinanceInvoiceKey: projectionKey,
        sourceFinanceOrganizationId: clean(data.organizationId, 250) || null,
        sourceFinanceSyncedAt: nowAt,
        shipmentSnapshot: {
          id: shipmentId,
          shipmentId:
            clean(shipment.trackingNumber || shipment.shipmentId || shipmentId, 250),
          sender,
          recipient,
          origin,
          destination,
          totals: shipment.totals || null,
          packages: [],
          status: shipment.status || null,
          currentTripId: tripId,
        },
        updatedAt: nowAt,
        updatedBy: "Atlas Finance",
        ...(created
          ? {
              createdAt: nowAt,
              createdBy: "Atlas Finance",
            }
          : {}),
      };
      transaction.set(invoiceRef, invoiceRecord, { merge: true });

      if (status === "CANCELLED") {
        if (!shipment.invoiceId || shipment.invoiceId === invoiceId) {
          transaction.set(
            shipmentRef,
            {
              invoiceId: null,
              invoiceNumber: null,
              invoiceStatus: "CANCELLED",
              hasInvoice: false,
              updatedAt: nowAt,
              updatedBy: "Atlas Finance",
            },
            { merge: true },
          );
        }
      } else {
        transaction.set(
          shipmentRef,
          {
            invoiceId,
            invoiceNumber: sourceFinanceInvoiceNumber,
            invoiceStatus: status,
            hasInvoice: true,
            updatedAt: nowAt,
            updatedBy: "Atlas Finance",
          },
          { merge: true },
        );
      }

      writeInvoiceActionLog({
        db,
        tx: transaction,
        action: created ? "SYNC_FINANCE_INVOICE" : "RESYNC_FINANCE_INVOICE",
        invoiceId,
        invoiceDocId: invoiceId,
        invoiceNumber: sourceFinanceInvoiceNumber,
        shipmentId,
        tripId,
        actorId: request.auth.uid,
        actorName: "Atlas Finance",
        actorRole,
        details: {
          sourceFinanceInvoiceId,
          amountCentavos,
          status,
        },
        createdAt: nowAt,
      });

      transaction.set(db.collection("invoice_events").doc(), {
        invoiceId,
        invoiceNumber: sourceFinanceInvoiceNumber,
        shipmentId,
        type: created ? "FINANCE_INVOICE_SYNCED" : "FINANCE_INVOICE_RESYNCED",
        status,
        actorId: request.auth.uid,
        at: now,
        note: `Finance invoice ${sourceFinanceInvoiceNumber} synchronized`,
      });

      return { created, tripId };
    });

    return {
      success: true,
      invoiceId,
      invoiceNumber: sourceFinanceInvoiceNumber,
      shipmentId,
      tripId: result.tripId,
      status,
      created: result.created,
    };
  },
);
