"use strict";

const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { canAccessRecord, isActiveProfile } = require("../manager/managerAccess");
const {
  MAX_PAYMENT_PROOF_BYTES,
  MAX_PAYMENT_PROOFS,
  safeFileName,
  validateProofFile,
  paymentMethodRequiresProof,
} = require("./paymentProofPolicy.cjs");
const {
  FINANCE_WEBHOOK_SECRET,
  makeEnvelope,
  outboxDocumentId,
  outboxRecord,
  deliverOutboxDocument,
} = require("./financeEventOutbox");
const { paymentPayload } = require("./paymentFinancePayload.cjs");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;
const ROLES = new Set(["admin", "administrator", "manager"]);
const PAYMENT_METHODS = new Set(["CASH", "BANK_TRANSFER", "GCASH", "CHECK"]);

function clean(value, max = 500) { return String(value ?? "").trim().slice(0, max); }
function stableId(prefix, ...values) { return `${prefix}_${crypto.createHash("sha256").update(values.join("\u0000")).digest("hex").slice(0, 32)}`; }
function pesosToCentavos(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
}
async function actorFor(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  const snapshot = await db.collection("users").doc(request.auth.uid).get();
  const profile = snapshot.exists ? snapshot.data() || {} : {};
  const role = clean(profile.role, 80).toLowerCase();
  if (!ROLES.has(role) || !isActiveProfile(profile)) throw new HttpsError("permission-denied", "An active Transport Admin or Manager account is required.");
  return { uid: request.auth.uid, role, profile, name: clean(profile.name || profile.displayName || request.auth.token?.name || request.auth.uid, 250) };
}

const uploadPaymentProof = onCall({ region: "asia-southeast1", maxInstances: 10, memory: "512MiB" }, async (request) => {
  const actor = await actorFor(request);
  const input = request.data || {};
  const invoiceId = clean(input.invoiceId, 250);
  const requestId = clean(input.requestId, 250);
  const base64Data = String(input.base64Data || "").replace(/^data:[^;]+;base64,/, "");
  if (!invoiceId || !requestId || !base64Data) {
    throw new HttpsError("invalid-argument", "Invoice, upload request ID, and payment proof are required.");
  }
  if (base64Data.length > Math.ceil(MAX_PAYMENT_PROOF_BYTES * 4 / 3) + 8) {
    throw new HttpsError("invalid-argument", "Each payment proof must be 15 MB or smaller.");
  }
  let buffer;
  try {
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    throw new HttpsError("invalid-argument", "The payment proof is not valid base64 data.");
  }
  const validation = validateProofFile({ contentType: input.contentType, buffer });
  if (!validation.valid) throw new HttpsError("invalid-argument", validation.message);

  const invoiceRef = db.collection("invoices").doc(invoiceId);
  const proofId = stableId("payment_proof", invoiceId, actor.uid, requestId);
  const proofRef = db.collection("paymentProofs").doc(proofId);
  const [invoiceSnapshot, existingProof] = await Promise.all([invoiceRef.get(), proofRef.get()]);
  if (!invoiceSnapshot.exists) throw new HttpsError("not-found", "Invoice not found.");
  const invoice = invoiceSnapshot.data() || {};
  if (actor.role === "manager" && !canAccessRecord(actor.profile, invoice)) {
    throw new HttpsError("permission-denied", "This invoice is outside your assigned scope.");
  }
  if (invoice.sourceReadOnly === true) throw new HttpsError("failed-precondition", "This invoice is not owned by Atlas Transport.");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (existingProof.exists) {
    const existing = existingProof.data() || {};
    if (existing.invoiceId !== invoiceId || existing.sha256 !== sha256) {
      throw new HttpsError("already-exists", "This upload request ID was already used for a different payment proof.");
    }
    return { success: true, duplicate: true, proofId, fileName: existing.fileName, contentType: existing.contentType, sizeBytes: existing.sizeBytes, sha256: existing.sha256 };
  }

  const fileName = safeFileName(input.fileName, validation.contentType);
  const storagePath = `payment-proofs/${invoiceId}/${proofId}/${fileName}`;
  const uploadedAtMs = Date.now();
  await admin.storage().bucket().file(storagePath).save(buffer, {
    resumable: false,
    contentType: validation.contentType,
    metadata: {
      cacheControl: "private, no-store",
      contentDisposition: `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
      metadata: { proofId, invoiceId, sha256, uploadedBy: actor.uid },
    },
  });
  const now = Timestamp.fromMillis(uploadedAtMs);
  await proofRef.create({
    id: proofId,
    invoiceId,
    invoiceNumber: invoice.invoiceNumber || invoiceId,
    fileName,
    contentType: validation.contentType,
    sizeBytes: validation.sizeBytes,
    sha256,
    storagePath,
    status: "STAGED",
    immutable: true,
    uploadedAtMs,
    uploadedAt: now,
    uploadedBy: actor.uid,
    uploadedByName: actor.name,
    warehouseId: invoice.warehouseId || invoice.shipmentSnapshot?.warehouseId || null,
    warehouseCode: invoice.warehouseCode || invoice.shipmentSnapshot?.warehouseCode || null,
    origin: invoice.origin || invoice.shipmentSnapshot?.origin || null,
    destination: invoice.destination || invoice.shipmentSnapshot?.destination || null,
    createdAt: now,
    updatedAt: now,
  });
  return { success: true, duplicate: false, proofId, fileName, contentType: validation.contentType, sizeBytes: validation.sizeBytes, sha256 };
});

const downloadPaymentProof = onCall({ region: "asia-southeast1", maxInstances: 10, memory: "512MiB" }, async (request) => {
  const actor = await actorFor(request);
  const proofId = clean(request.data?.proofId, 250);
  if (!proofId) throw new HttpsError("invalid-argument", "Payment proof is required.");
  const proofSnapshot = await db.collection("paymentProofs").doc(proofId).get();
  if (!proofSnapshot.exists) throw new HttpsError("not-found", "Payment proof not found.");
  const proof = proofSnapshot.data() || {};
  const invoiceSnapshot = await db.collection("invoices").doc(proof.invoiceId).get();
  if (!invoiceSnapshot.exists) throw new HttpsError("failed-precondition", "The payment proof invoice no longer exists.");
  const invoice = invoiceSnapshot.data() || {};
  if (actor.role === "manager" && !canAccessRecord(actor.profile, invoice)) {
    throw new HttpsError("permission-denied", "This payment proof is outside your assigned scope.");
  }
  const [buffer] = await admin.storage().bucket().file(proof.storagePath).download();
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== proof.sha256) throw new HttpsError("data-loss", "Payment proof integrity validation failed.");
  return {
    proofId,
    fileName: proof.fileName,
    contentType: proof.contentType,
    sizeBytes: proof.sizeBytes,
    sha256,
    base64Data: buffer.toString("base64"),
  };
});

const recordShipmentPayment = onCall({ region: "asia-southeast1", maxInstances: 10, memory: "512MiB", secrets: [FINANCE_WEBHOOK_SECRET] }, async (request) => {
  const actor = await actorFor(request);
  const input = request.data || {};
  const invoiceId = clean(input.invoiceId, 250);
  const requestId = clean(input.requestId, 250);
  const amountCentavos = Number.isSafeInteger(Number(input.amountCentavos)) ? Number(input.amountCentavos) : pesosToCentavos(input.amount);
  const method = clean(input.method || "CASH", 80).toUpperCase();
  const referenceNumber = clean(input.referenceNumber, 180) || null;
  const destinationCode = clean(input.destinationCode, 100) || null;
  const proofDocumentIds = [...new Set((Array.isArray(input.proofDocumentIds) ? input.proofDocumentIds : []).map((value) => clean(value, 250)).filter(Boolean))];
  const receivedAtMs = Number(input.receivedAtMs || Date.parse(input.receivedAt || "")) || Date.now();
  if (!invoiceId || !requestId || !Number.isSafeInteger(amountCentavos) || amountCentavos <= 0 || !Number.isSafeInteger(receivedAtMs)) {
    throw new HttpsError("invalid-argument", "Invoice, request ID, payment date, and a positive amount are required.");
  }
  if (!PAYMENT_METHODS.has(method)) throw new HttpsError("invalid-argument", "Select a supported payment method.");
  if (proofDocumentIds.length > MAX_PAYMENT_PROOFS) throw new HttpsError("invalid-argument", `Attach no more than ${MAX_PAYMENT_PROOFS} payment proofs.`);
  if (paymentMethodRequiresProof(method) && proofDocumentIds.length === 0) {
    throw new HttpsError("failed-precondition", "A payment proof is required for bank transfer, GCash, and check payments.");
  }
  const invoiceRef = db.collection("invoices").doc(invoiceId);
  const paymentId = stableId("payment", invoiceId, actor.uid, requestId);
  const requestRef = db.collection("paymentRequestReservations").doc(stableId("payment_request", actor.uid, requestId));
  const referenceRef = referenceNumber ? db.collection("paymentReferenceReservations").doc(stableId("payment_reference", invoiceId, referenceNumber.toUpperCase())) : null;
  const proofRefs = proofDocumentIds.map((proofId) => db.collection("paymentProofs").doc(proofId));
  const result = await db.runTransaction(async (tx) => {
    const reads = [tx.get(invoiceRef), tx.get(requestRef)];
    if (referenceRef) reads.push(tx.get(referenceRef));
    proofRefs.forEach((proofRef) => reads.push(tx.get(proofRef)));
    const snapshots = await Promise.all(reads);
    const invoiceSnapshot = snapshots[0];
    const requestSnapshot = snapshots[1];
    const referenceSnapshot = referenceRef ? snapshots[2] : null;
    const proofOffset = referenceRef ? 3 : 2;
    const proofSnapshots = snapshots.slice(proofOffset);
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
    const proofDocuments = proofSnapshots.map((snapshot, index) => {
      if (!snapshot.exists) throw new HttpsError("not-found", "A selected payment proof no longer exists.");
      const proof = snapshot.data() || {};
      if (proof.invoiceId !== invoiceId) throw new HttpsError("permission-denied", "A payment proof belongs to a different invoice.");
      if (proof.status === "BOUND" && proof.paymentId !== paymentId) throw new HttpsError("failed-precondition", "A payment proof is already attached to another payment.");
      if (!['STAGED', 'BOUND'].includes(proof.status)) throw new HttpsError("failed-precondition", "A selected payment proof is not available.");
      return {
        proofId: proofDocumentIds[index],
        fileName: proof.fileName,
        contentType: proof.contentType,
        sizeBytes: proof.sizeBytes,
        sha256: proof.sha256,
        storagePath: proof.storagePath,
        uploadedAtMs: proof.uploadedAtMs,
        uploadedBy: proof.uploadedBy,
      };
    });
    const paymentNumber = `PAY-${new Date(receivedAtMs).toISOString().slice(0, 10).replace(/-/g, "")}-${paymentId.slice(-8).toUpperCase()}`;
    const sourceVersion = 1;
    const payment = { id: paymentId, paymentNumber, invoiceId, customerId: invoice.customerId || invoice.shipmentSnapshot?.sender?.uid || null, customerName: invoice.billingName || invoice.senderName || null, receivedAtMs, amountCentavos, method, referenceNumber, destinationCode, proofDocumentIds, proofDocuments, status: "APPROVED", sourceVersion };
    const envelope = makeEnvelope({ eventType: "SHIPMENT_PAYMENT_CREATED", entityId: paymentId, sourceVersion, occurredAtMs: Date.now(), correlationId: invoice.tripId || invoice.shipmentId || invoiceId, payload: paymentPayload(payment) });
    const outboxId = outboxDocumentId(envelope);
    const now = Timestamp.now();
    const nextPaid = previouslyPaid + amountCentavos;
    tx.create(db.collection("shipmentPayments").doc(paymentId), { ...payment, amount: amountCentavos / 100, receivedAt: Timestamp.fromMillis(receivedAtMs), paymentDate: Timestamp.fromMillis(receivedAtMs), sourceSystem: "atlas-tracking", immutable: true, warehouseId: invoice.warehouseId || invoice.shipmentSnapshot?.warehouseId || null, warehouseCode: invoice.warehouseCode || invoice.shipmentSnapshot?.warehouseCode || null, origin: invoice.origin || invoice.shipmentSnapshot?.origin || null, destination: invoice.destination || invoice.shipmentSnapshot?.destination || null, createdBy: actor.uid, createdByName: actor.name, createdAt: now, updatedAt: now });
    tx.create(db.collection("financeEventOutbox").doc(outboxId), outboxRecord(envelope, now));
    tx.create(requestRef, { paymentId, outboxId, actorId: actor.uid, requestId, createdAt: now });
    if (referenceRef) tx.create(referenceRef, { paymentId, invoiceId, referenceNumber, createdAt: now });
    proofRefs.forEach((proofRef) => tx.update(proofRef, { status: "BOUND", paymentId, paymentNumber, boundAt: now, updatedAt: now }));
    tx.update(invoiceRef, { amountPaidCentavos: nextPaid, balanceCentavos: invoiceCentavos - nextPaid, status: nextPaid === invoiceCentavos ? "PAID" : "ISSUED", lastPaymentId: paymentId, lastPaymentProofs: proofDocuments, updatedBy: actor.name, updatedAt: now });
    tx.create(db.collection("invoice_events").doc(), { invoiceId, invoiceNumber: invoice.invoiceNumber || invoiceId, shipmentId: invoice.shipmentId || null, type: "PAYMENT_RECORDED", paymentId, paymentNumber, amountCentavos, proofDocumentIds, actorId: actor.uid, at: now, note: `Payment ${paymentNumber} recorded` });
    return { duplicate: false, paymentId, paymentNumber, outboxId, proofDocuments };
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
    tx.update(invoiceRef, { amountPaidCentavos: paid, balanceCentavos: Math.max(0, total - paid), status: paid === total && total > 0 ? "PAID" : "ISSUED", lastPaymentId: priorActive?.id || null, lastPaymentProofs: priorActive?.data()?.proofDocuments || [], updatedBy: actor.name, updatedAt: now });
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

module.exports = { uploadPaymentProof, downloadPaymentProof, recordShipmentPayment, reverseShipmentPayment, retryFinanceEventOutbox, _test: { pesosToCentavos, paymentPayload, stableId } };
