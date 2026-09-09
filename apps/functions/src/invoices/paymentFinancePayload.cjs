"use strict";

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
    proofDocuments: Array.isArray(payment.proofDocuments)
      ? payment.proofDocuments.map((proof) => ({
          proofId: proof.proofId,
          fileName: proof.fileName,
          contentType: proof.contentType,
          sizeBytes: proof.sizeBytes,
          sha256: proof.sha256,
          storagePath: proof.storagePath,
          uploadedAtMs: proof.uploadedAtMs,
          uploadedBy: proof.uploadedBy,
        }))
      : [],
    allocations: [
      { invoiceId: payment.invoiceId, amountCentavos: payment.amountCentavos },
    ],
  };
}

module.exports = { paymentPayload };
