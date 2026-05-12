"use client";

import { useCallback, useState } from "react";
import {
  createInvoice,
  editInvoice,
  updateInvoiceStatus,
} from "@/app/utility/FirebaseFunctions";
import { updatedBy } from "@/app/utility/utilities";

export default function useInvoiceWorkflow({
  user,
  onRefresh,
  onError,
  profile,
} = {}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

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
    setFormMode("create");
    setSelectedShipment(shipment);
    setSelectedInvoice(null);
    setIsFormOpen(true);
  }, []);

  const openEditInvoice = useCallback(
    (invoice, shipment = null) => {
      if (!invoice) return;

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

  const submitInvoice = useCallback(
    async (payload) => {
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
        handleError("Error saving invoice", error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [closeForm, formMode, handleError, refresh, selectedInvoice],
  );

  const changeInvoiceStatus = useCallback(
    async (invoice, status, { sendNotification = false } = {}) => {
      if (!invoice?.id || !status) return false;

      try {
        await updateInvoiceStatus({
          invoiceId: invoice.id,
          status,
          sendNotification,
          updatedBy: updatedBy(profile),
        });

        setSelectedInvoice((prev) =>
          prev?.id === invoice.id ? { ...prev, status } : prev,
        );

        await refresh();
        return true;
      } catch (error) {
        handleError("Error updating invoice status", error);
        return false;
      }
    },
    [handleError, refresh],
  );

  return {
    isFormOpen,
    isDetailsOpen,
    isSaving,
    formMode,
    selectedShipment,
    selectedInvoice,
    openCreateInvoice,
    openEditInvoice,
    openInvoiceDetails,
    openInvoiceDetailsById,
    closeForm,
    closeDetails,
    submitInvoice,
    changeInvoiceStatus,
  };
}
