"use client";

import { useCallback, useState } from "react";
import {
  createInvoice,
  editInvoice,
  recordShipmentPayment,
  reverseShipmentPayment,
  uploadPaymentProof,
  updateInvoiceStatus,
} from "@/app/utility/FirebaseFunctions";
import { updatedBy } from "@/app/utility/utilities";

function getInvoiceSubmitError(error) {
  const rawMessage = String(error?.message || "").trim();

  if (/missing billingname|billing name.*required/i.test(rawMessage)) {
    return "Billing Name is required. This shipment has no receiver information, so enter the billing name manually or update the shipment.";
  }

  if (/already exists/i.test(rawMessage)) {
    return "An active invoice already exists for this shipment.";
  }

  if (/does not belong to the selected trip/i.test(rawMessage)) {
    return "The selected shipment does not belong to the selected trip. Select the trip and shipment again.";
  }

  const cleanedMessage = rawMessage
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, "")
    .trim();

  return cleanedMessage || "The invoice could not be saved. Please try again.";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("The payment proof could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function useInvoiceWorkflow({
  user,
  onRefresh,
  onError,
  profile,
} = {}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [statusError, setStatusError] = useState("");

  const handleError = useCallback(
    (message, error) => {
      console.error(message, error);
      onError?.(message, error);
    },
    [onError],
  );

  const refresh = useCallback(async () => {
    await onRefresh?.();
  }, [onRefresh]);

  const resolveShipment = useCallback((invoice, shipment = null) => {
    if (shipment || invoice?.shipment || invoice?.shipmentSnapshot) {
      return shipment || invoice.shipment || invoice.shipmentSnapshot;
    }

    if (!invoice) return null;

    return {
      id: invoice.shipmentId || "",
      shipmentId: invoice.shipmentTrackingNumber || invoice.shipmentId || "",
      sender: {
        name: invoice.senderName || "",
        phone: invoice.senderPhone || "",
      },
      recipient: {
        name: invoice.recipientName || "",
        phone: invoice.recipientPhone || "",
      },
      origin: invoice.origin || "",
      destination: invoice.destination || "",
      status: invoice.shipmentStatus || "",
      currentTripId: invoice.truckTripId || "",
      packages: [],
      totals: {
        totalItems: invoice.totalItems || 0,
      },
    };
  }, []);

  const openCreateInvoice = useCallback((shipment = null) => {
    setSubmitError("");
    setFormMode("create");
    setSelectedShipment(shipment);
    setSelectedInvoice(null);
    setIsFormOpen(true);
  }, []);

  const openEditInvoice = useCallback(
    (invoice, shipment = null) => {
      if (!invoice) return;

      setSubmitError("");
      setFormMode("edit");
      setSelectedInvoice(invoice);
      setSelectedShipment(resolveShipment(invoice, shipment));
      setIsDetailsOpen(false);
      setIsFormOpen(true);
    },
    [resolveShipment],
  );

  const openInvoiceDetails = useCallback(
    (invoice, shipment = null) => {
      if (!invoice) return;

      setSelectedInvoice(invoice);
      setSelectedShipment(resolveShipment(invoice, shipment));
      setIsDetailsOpen(true);
    },
    [resolveShipment],
  );

  const openInvoiceDetailsById = useCallback(
    async (invoiceId, shipment = null) => {
      if (!invoiceId) {
        handleError(
          "Cannot open invoice: missing invoiceId",
          new Error("Missing invoiceId"),
        );
        return null;
      }

      try {
        const token = await user?.getIdToken();

        const res = await fetch(
          `/api/invoices/${encodeURIComponent(invoiceId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch invoice");

        openInvoiceDetails(json.invoice, shipment);
        return json.invoice;
      } catch (error) {
        handleError("Error opening invoice", error);
        return null;
      }
    },
    [handleError, openInvoiceDetails, user],
  );

  const closeForm = useCallback(() => {
    setSubmitError("");
    setIsFormOpen(false);
    setSelectedShipment(null);
    setSelectedInvoice(null);
    setFormMode("create");
  }, []);

  const closeDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setSelectedShipment(null);
    setSelectedInvoice(null);
  }, []);

  const clearStatusError = useCallback(() => setStatusError(""), []);

  const submitInvoice = useCallback(
    async (payload) => {
      setSubmitError("");
      setIsSaving(true);

      try {
        if (formMode === "edit" && selectedInvoice?.id) {
          await editInvoice({
            invoiceId: selectedInvoice.id,
            ...payload,
            updatedBy: updatedBy(profile),
          });
        } else {
          await createInvoice({ ...payload, updatedBy: updatedBy(profile) });
        }

        await refresh();
        closeForm();
        return true;
      } catch (error) {
        console.error("Error saving invoice", error);
        setSubmitError(getInvoiceSubmitError(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [closeForm, formMode, profile, refresh, selectedInvoice],
  );

  const changeInvoiceStatus = useCallback(
    async (invoice, status, { sendNotification = false, payment = {} } = {}) => {
      if (!invoice?.id || !status) return false;

      setStatusError("");
      setIsStatusSaving(true);
      try {
        let paymentResult = null;
        if (status === "PAID") {
          const totalCentavos = Math.round(Number(invoice.amount || 0) * 100);
          const amountCentavos = Number(payment.amountCentavos) || Math.max(0, totalCentavos - Number(invoice.amountPaidCentavos || 0));
          const proofFiles = Array.isArray(payment.proofFiles) ? payment.proofFiles : [];
          const proofUploads = await Promise.all(proofFiles.map(async (file) => {
            const response = await uploadPaymentProof({
              invoiceId: invoice.id,
              requestId: crypto.randomUUID(),
              fileName: file.name,
              contentType: file.type,
              base64Data: await fileToBase64(file),
            });
            return response.data;
          }));
          const paymentResponse = await recordShipmentPayment({
            invoiceId: invoice.id,
            requestId: payment.requestId || crypto.randomUUID(),
            amountCentavos,
            receivedAtMs: payment.receivedAtMs || Date.now(),
            method: payment.method || "CASH",
            referenceNumber: payment.referenceNumber || null,
            destinationCode: payment.destinationCode || null,
            proofDocumentIds: proofUploads.map((proof) => proof.proofId),
          });
          paymentResult = paymentResponse.data || null;
        } else {
          await updateInvoiceStatus({
            invoiceId: invoice.id,
            status,
            sendNotification,
            updatedBy: updatedBy(profile),
          });
        }

        setSelectedInvoice((prev) =>
          prev?.id === invoice.id ? {
            ...prev,
            status,
            ...(status === "PAID" ? {
              lastPaymentId: paymentResult?.paymentId || prev.lastPaymentId,
              lastPaymentProofs: paymentResult?.proofDocuments || prev.lastPaymentProofs || [],
            } : {}),
          } : prev,
        );

        await refresh();
        return true;
      } catch (error) {
        handleError("Error updating invoice status", error);
        setStatusError(getInvoiceSubmitError(error));
        return false;
      } finally {
        setIsStatusSaving(false);
      }
    },
    [handleError, refresh],
  );

  const reversePayment = useCallback(async (invoice, reason) => {
    if (!invoice?.lastPaymentId || !String(reason || "").trim()) return false;
    try {
      await reverseShipmentPayment({
        paymentId: invoice.lastPaymentId,
        requestId: crypto.randomUUID(),
        reason: String(reason).trim(),
      });
      setSelectedInvoice((previous) => previous?.id === invoice.id ? { ...previous, status: "ISSUED", lastPaymentId: null } : previous);
      await refresh();
      return true;
    } catch (error) {
      handleError("Error reversing payment", error);
      return false;
    }
  }, [handleError, refresh]);

  return {
    isFormOpen,
    isDetailsOpen,
    isSaving,
    isStatusSaving,
    submitError,
    statusError,
    formMode,
    selectedShipment,
    selectedInvoice,
    openCreateInvoice,
    openEditInvoice,
    openInvoiceDetails,
    openInvoiceDetailsById,
    closeForm,
    closeDetails,
    clearStatusError,
    submitInvoice,
    changeInvoiceStatus,
    reversePayment,
  };
}
