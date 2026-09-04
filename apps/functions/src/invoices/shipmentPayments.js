"use strict";

const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { canAccessRecord, isActiveProfile } = require("../manager/managerAccess");
const {
  FINANCE_WEBHOOK_SECRET,
  makeEnvelope,
  outboxDocumentId,
  outboxRecord,
  deliverOutboxDocument,
} = require("./financeEventOutbox");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;
const ROLES = new Set(["admin", "administrator", "manager"]);

function clean(value, max = 500) { return String(value ?? "").trim().slice(0, max); }
function stableId(prefix, ...values) { return `${prefix}_${crypto.createHash("sha256").update(values.join("\u0000")).digest("hex").slice(0, 32)}`; }
function pesosToCentavos(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
}
function paymentPayload(payment) {
  return {
    paymentId: payment.id,
    paymentNumber: payment.paymentNumber,
    invoiceId: payment.invoiceId,
    customerId: payment.customerId,
    customerName: payment.customerName,
    receivedAt: payment.receivedAtMs,
    amountCentavos: payment.amountCentavos,
    method: payment.method,
    referenceNumber: payment.referenceNumber,
    destinationCode: payment.destinationCode,
    status: payment.status,
    sourceVersion: payment.sourceVersion,
    reversed: payment.status === "REVERSED",
    reversalReason: payment.reversalReason || null,
    allocations: [{ invoiceId: payment.invoiceId, amountCentavos: payment.amountCentavos }],
  };
}
async function actorFor(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  const snapshot = await db.collection("users").doc(request.auth.uid).get();
  const profile = snapshot.exists ? snapshot.data() || {} : {};
  const role = clean(profile.role, 80).toLowerCase();
  if (!ROLES.has(role) || !isActiveProfile(profile)) throw new HttpsError("permission-denied", "An active Transport Admin or Manager account is required.");
  return { uid: request.auth.uid, role, profile, name: clean(profile.name || profile.displayName || request.auth.token?.name || request.auth.uid, 250) };
}

const recordShipmentPayment = onCall({ region: "asia-southeast1", maxInstances: 10, memory: "512MiB", secrets: [FINANCE_WEBHOOK_SECRET] }, async (request) => {
  const actor = await actorFor(request);
  const input = request.data || {};
  const invoiceId = clean(input.invoiceId, 250);
  const requestId = clean(input.requestId, 250);
  const amountCentavos = Number.isSafeInteger(Number(input.amountCentavos)) ? Number(input.amountCentavos) : pesosToCentavos(input.amount);
  const method = clean(input.method || "CASH", 80).toUpperCase();
  const referenceNumber = clean(input.referenceNumber, 180) || null;
  const destinationCode = clean(input.destinationCode, 100) || null;
  const receivedAtMs = Number(input.receivedAtMs || Date.parse(input.receivedAt || "")) || Date.now();
  if (!invoiceId || !requestId || !Number.isSafeInteger(amountCentavos) || amountCentavos <= 0 || !Number.isSafeInteger(receivedAtMs)) {
    throw new HttpsError("invalid-argument", "Invoice, request ID, payment date, and a positive amount are required.");
  }
  const invoiceRef = db.collection("invoices").doc(invoiceId);
  const requestRef = db.collection("paymentRequestReservations").doc(stableId("payment_request", actor.uid, requestId));
  const referenceRef = referenceNumber ? db.collection("paymentReferenceReservations").doc(stableId("payment_reference", invoiceId, referenceNumber.toUpperCase())) : null;
  const result = await db.runTransaction(async (tx) => {
    const reads = [tx.get(invoiceRef), tx.get(requestRef)];
    if (referenceRef) reads.push(tx.get(referenceRef));
    const [invoiceSnapshot, requestSnapshot, referenceSnapshot] = await Promise.all(reads);
    if (requestSnapshot.exists) return { duplicate: true, paymentId: requestSnapshot.data().paymentId, outboxId: requestSnapshot.data().outboxId };
    if (referenceSnapshot?.exists) throw new HttpsError("already-exists", "This payment reference was already recorded for the invoice.");
    if (!invoiceSnapshot.exists) throw new HttpsError("not-found", "Invoice not found.");
    const invoice = invoiceSnapshot.data() || {};
    if (actor.role === "manager" && !canAccessRecord(actor.profile, invoice)) throw new HttpsError("permission-denied", "This invoice is outside your assigned scope.");
    if (invoice.sourceReadOnly === true) throw new HttpsError("failed-precondition", "This invoice is not owned by Atlas Transport.");
    if (!["ISSUED", "PAID"].includes(clean(invoice.status, 40).toUpperCase())) throw new HttpsError("failed-precondition", "Only an issued invoice can receive a payment.");
    const invoiceCentavos = pesosToCentavos(invoice.amount) || 0;
    const previouslyPaid = Number(invoice.amountPaidCentavos || 0);
    const outstanding = Math.max(0, invoiceCentavos - previouslyPaid);
    if (amountCentavos > outstanding) throw new HttpsError("failed-precondition", "Payment amount exceeds the invoice balance.");
    const paymentId = stableId("payment", invoiceId, actor.uid, requestId);
    const paymentNumber = `PAY-${new Date(receivedAtMs).toISOString().slice(0, 10).replace(/-/g, "")}-${paymentId.slice(-8).toUpperCase()}`;
    const sourceVersion = 1;
    const payment = { id: paymentId, paymentNumber, invoiceId, customerId: invoice.customerId || invoice.shipmentSnapshot?.sender?.uid || null, customerName: invoice.billingName || invoice.senderName || null, receivedAtMs, amountCentavos, method, referenceNumber, destinationCode, status: "APPROVED", sourceVersion };
    const envelope = makeEnvelope({ eventType: "SHIPMENT_PAYMENT_CREATED", entityId: paymentId, sourceVersion, occurredAtMs: Date.now(), correlationId: invoice.tripId || invoice.shipmentId || invoiceId, payload: paymentPayload(payment) });
    const outboxId = outboxDocumentId(envelope);
    const now = Timestamp.now();
    const nextPaid = previouslyPaid + amountCentavos;
    tx.create(db.collection("shipmentPayments").doc(paymentId), { ...payment, amount: amountCentavos / 100, receivedAt: Timestamp.fromMillis(receivedAtMs), paymentDate: Timestamp.fromMillis(receivedAtMs), sourceSystem: "atlas-tracking", immutable: true, warehouseId: invoice.warehouseId || invoice.shipmentSnapshot?.warehouseId || null, warehouseCode: invoice.warehouseCode || invoice.shipmentSnapshot?.warehouseCode || null, origin: invoice.origin || invoice.shipmentSnapshot?.origin || null, destination: invoice.destination || invoice.shipmentSnapshot?.destination || null, createdBy: actor.uid, createdByName: actor.name, createdAt: now, updatedAt: now });
    tx.create(db.collection("financeEventOutbox").doc(outboxId), outboxRecord(envelope, now));
    tx.create(requestRef, { paymentId, outboxId, actorId: actor.uid, requestId, createdAt: now });
    if (referenceRef) tx.create(referenceRef, { paymentId, invoiceId, referenceNumber, createdAt: now });
    tx.update(invoiceRef, { amountPaidCentavos: nextPaid, balanceCentavos: invoiceCentavos - nextPaid, status: nextPaid === invoiceCentavos ? "PAID" : "ISSUED", lastPaymentId: paymentId, updatedBy: actor.name, updatedAt: now });
    tx.create(db.collection("invoice_events").doc(), { invoiceId, invoiceNumber: invoice.invoiceNumber || invoiceId, shipmentId: invoice.shipmentId || null, type: "PAYMENT_RECORDED", paymentId, paymentNumber, amountCentavos, actorId: actor.uid, at: now, note: `Payment ${paymentNumber} recorded` });
    return { duplicate: false, paymentId, outboxId };
  });
  const delivery = await deliverOutboxDocument(db.collection("financeEventOutbox").doc(result.outboxId), FINANCE_WEBHOOK_SECRET.value());
  return { success: true, ...result, financeDeliveryStatus: delivery.status };
});

const reverseShipmentPayment = onCall({ region: "asia-southeast1", maxInstances: 10, memory: "512MiB", secrets: [FINANCE_WEBHOOK_SECRET] }, async (request) => {
  const actor = await actorFor(request);
  const paymentId = clean(request.data?.paymentId, 250);
  const requestId = clean(request.data?.requestId, 250);
  const reason = clean(request.data?.reason, 1000);
  if (!paymentId || !requestId || !reason) throw new HttpsError("invalid-argument", "Payment, request ID, and reversal reason are required.");
  const paymentRef = db.collection("shipmentPayments").doc(paymentId);
  const requestRef = db.collection("paymentRequestReservations").doc(stableId("payment_reversal", actor.uid, requestId));
  const result = await db.runTransaction(async (tx) => {
    const [paymentSnapshot, requestSnapshot] = await Promise.all([tx.get(paymentRef), tx.get(requestRef)]);
    if (requestSnapshot.exists) return { duplicate: true, paymentId, outboxId: requestSnapshot.data().outboxId };
    if (!paymentSnapshot.exists) throw new HttpsError("not-found", "Payment not found.");
    const payment = paymentSnapshot.data() || {};
    if (payment.status === "REVERSED") throw new HttpsError("failed-precondition", "Payment is already reversed.");
    const invoiceRef = db.collection("invoices").doc(payment.invoiceId);
    const [invoiceSnapshot, invoicePayments] = await Promise.all([
      tx.get(invoiceRef),
      tx.get(db.collection("shipmentPayments").where("invoiceId", "==", payment.invoiceId)),
    ]);
    if (!invoiceSnapshot.exists) throw new HttpsError("failed-precondition", "The payment invoice no longer exists.");
    const invoice = invoiceSnapshot.data() || {};
    if (actor.role === "manager" && !canAccessRecord(actor.profile, invoice)) throw new HttpsError("permission-denied", "This payment is outside your assigned scope.");
    const sourceVersion = Number(payment.sourceVersion || 1) + 1;
    const next = { ...payment, id: paymentId, sourceVersion, status: "REVERSED", reversalReason: reason };
    const envelope = makeEnvelope({ eventType: "SHIPMENT_PAYMENT_REVERSED", entityId: paymentId, sourceVersion, occurredAtMs: Date.now(), correlationId: invoice.tripId || invoice.shipmentId || invoice.id, causationId: payment.financeEventId || null, payload: paymentPayload(next) });
    const outboxId = outboxDocumentId(envelope);
    const now = Timestamp.now();
    const paid = Math.max(0, Number(invoice.amountPaidCentavos || 0) - Number(payment.amountCentavos || 0));
    const total = pesosToCentavos(invoice.amount) || 0;
    const priorActive = invoicePayments.docs
      .filter((document) => document.id !== paymentId && document.data()?.status !== "REVERSED")
      .sort((left, right) => Number(right.data()?.receivedAtMs || 0) - Number(left.data()?.receivedAtMs || 0))[0];
    tx.update(paymentRef, { status: "REVERSED", sourceVersion, reversalReason: reason, reversedBy: actor.uid, reversedByName: actor.name, reversedAt: now, updatedAt: now });
    tx.create(db.collection("financeEventOutbox").doc(outboxId), outboxRecord(envelope, now));
    tx.create(requestRef, { paymentId, outboxId, actorId: actor.uid, requestId, createdAt: now });
    tx.update(invoiceRef, { amountPaidCentavos: paid, balanceCentavos: Math.max(0, total - paid), status: paid === total && total > 0 ? "PAID" : "ISSUED", lastPaymentId: priorActive?.id || null, updatedBy: actor.name, updatedAt: now });
    tx.create(db.collection("invoice_events").doc(), { invoiceId: payment.invoiceId, invoiceNumber: invoice.invoiceNumber || payment.invoiceId, shipmentId: invoice.shipmentId || null, type: "PAYMENT_REVERSED", paymentId, amountCentavos: payment.amountCentavos, reason, actorId: actor.uid, at: now, note: `Payment ${payment.paymentNumber || paymentId} reversed` });
    return { duplicate: false, paymentId, outboxId };
  });
  const delivery = await deliverOutboxDocument(db.collection("financeEventOutbox").doc(result.outboxId), FINANCE_WEBHOOK_SECRET.value());
  return { success: true, ...result, financeDeliveryStatus: delivery.status };
});

const retryFinanceEventOutbox = onSchedule({ region: "asia-southeast1", schedule: "every 1 minutes", timeZone: "Asia/Manila", secrets: [FINANCE_WEBHOOK_SECRET], maxInstances: 1 }, async () => {
  const nowTimestamp = Timestamp.now();
  const due = await db.collection("financeEventOutbox")
    .where("status", "in", ["PENDING", "FAILED"])
    .where("nextAttemptAt", "<=", nowTimestamp)
    .orderBy("nextAttemptAt", "asc")
    .limit(50)
    .get();
  for (const document of due.docs) {
    await deliverOutboxDocument(document.ref, FINANCE_WEBHOOK_SECRET.value());
  }
});

module.exports = { recordShipmentPayment, reverseShipmentPayment, retryFinanceEventOutbox, _test: { pesosToCentavos, paymentPayload, stableId } };
