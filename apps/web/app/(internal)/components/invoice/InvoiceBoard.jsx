"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";

import InvoiceFormModal from "./InvoiceFormModal";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import InvoiceTable from "./InvoiceTable";
import InvoiceStatistics from "./InvoiceStatistics";
import useInvoiceWorkflow from "./useInvoiceWorkflow";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faPaperclip, faTrash } from "@fortawesome/free-solid-svg-icons";

const PAYMENT_PROOF_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
const MAX_PAYMENT_PROOF_BYTES = 15 * 1024 * 1024;
const MAX_PAYMENT_PROOFS = 5;

const InvoiceBoard = forwardRef(function InvoiceBoard(
  { user, isDark = false, profile },
  ref,
) {
  const [shipments, setShipments] = useState([]);
  const [trips, setTrips] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const theme = getBoardThemeClasses(isDark);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmInvoice, setConfirmInvoice] = useState(null);
  const [sendNotification, setSendNotification] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDestination, setPaymentDestination] = useState("");
  const [paymentProofFiles, setPaymentProofFiles] = useState([]);
  const [paymentValidationError, setPaymentValidationError] = useState("");

  const fetchInvoicesAndShipments = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const token = await user.getIdToken();

      const [shipmentsRes, tripsRes, invoicesRes] = await Promise.all([
        fetch("/api/shipments", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
        fetch(
          "/api/trips?view=board&activeLimit=all&completedLimit=all",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        ),
        fetch("/api/invoices", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
      ]);

      if (!shipmentsRes.ok) throw new Error("Failed to fetch shipments");
      if (!tripsRes.ok) throw new Error("Failed to fetch trips");
      if (!invoicesRes.ok) throw new Error("Failed to fetch invoices");

      const shipmentsData = await shipmentsRes.json();
      const tripsData = await tripsRes.json();
      const invoicesData = await invoicesRes.json();

      setShipments(shipmentsData.shipments || []);
      setTrips(tripsData.trips || []);
      setInvoices(invoicesData.invoices || []);
    } catch (err) {
      console.error("Error fetching invoices/shipments:", err);
    } finally {
      setLoading(false);
    }
  };

  const invoiceWorkflow = useInvoiceWorkflow({
    user,
    onRefresh: fetchInvoicesAndShipments,
    profile,
  });

  const {
    isFormOpen,
    isDetailsOpen,
    isSaving: isInvoiceSaving,
    isStatusSaving,
    submitError: invoiceSubmitError,
    statusError,
    formMode,
    selectedShipment,
    selectedInvoice,
    openCreateInvoice,
    openEditInvoice,
    openInvoiceDetails,
    closeForm,
    closeDetails,
    clearStatusError,
    submitInvoice,
    changeInvoiceStatus,
    reversePayment,
  } = invoiceWorkflow;

  useEffect(() => {
    fetchInvoicesAndShipments();
  }, []);

  const invoiceByShipmentId = useMemo(() => {
    return invoices.reduce((acc, invoice) => {
      if (invoice?.shipmentId && invoice.status !== "CANCELLED") {
        acc[invoice.shipmentId] = invoice;
      }
      return acc;
    }, {});
  }, [invoices]);

  const mappedInvoices = useMemo(() => {
    return invoices.map((invoice) => {
      const shipment =
        shipments.find((item) => item.id === invoice.shipmentId) ||
        invoice.shipmentSnapshot ||
        null;

      return {
        ...invoice,
        shipment,
        shipmentId: invoice.shipmentId || shipment?.id || "—",
        senderName:
          invoice.senderName || shipment?.sender?.name || "Unknown Sender",
        recipientName:
          invoice.recipientName ||
          shipment?.recipient?.name ||
          "Unknown Recipient",
        routeLabel:
          invoice.routeLabel ||
          `${shipment?.origin || "Unknown"} → ${shipment?.destination || "Unknown"}`,
        totalPackages: invoice.totalPackages || shipment?.packages?.length || 0,
        totalItems: invoice.totalItems || shipment?.totals?.totalItems || 0,
        amount: Number(invoice.amount || 0),
        status: invoice.status || "DRAFT",
      };
    });
  }, [invoices, shipments]);

  const eligibleShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      const hasInvoice = !!invoiceByShipmentId[shipment.id];
      if (hasInvoice) return false;
      if (shipment.archived) return false;
      if (shipment.status === "CANCELLED") return false;
      return true;
    });
  }, [shipments, invoiceByShipmentId]);

  const counts = useMemo(() => {
    return {
      total: mappedInvoices.length,
      draft: mappedInvoices.filter((item) => item.status === "DRAFT").length,
      issued: mappedInvoices.filter((item) => item.status === "ISSUED").length,
      paid: mappedInvoices.filter((item) => item.status === "PAID").length,
      cancelled: mappedInvoices.filter((item) => item.status === "CANCELLED")
        .length,
    };
  }, [mappedInvoices]);

  const handleOpenConfirm = (invoice, action) => {
    clearStatusError();
    setConfirmInvoice(invoice);
    setConfirmAction(action);
    setSendNotification(true);
    setPaymentMethod("CASH");
    setPaymentReference("");
    setPaymentDestination("");
    setPaymentProofFiles([]);
    setPaymentValidationError("");
    setIsConfirmOpen(true);
  };

  const handleCloseConfirm = () => {
    clearStatusError();
    setIsConfirmOpen(false);
    setConfirmInvoice(null);
    setConfirmAction(null);
    setSendNotification(true);
    setPaymentProofFiles([]);
    setPaymentValidationError("");
  };

  const handlePaymentProofSelection = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    const combined = [...paymentProofFiles, ...selected];
    if (combined.length > MAX_PAYMENT_PROOFS) {
      setPaymentValidationError(`Attach no more than ${MAX_PAYMENT_PROOFS} payment proofs.`);
      return;
    }
    const invalidType = selected.find((file) => !PAYMENT_PROOF_TYPES.has(String(file.type || "").toLowerCase()));
    if (invalidType) {
      setPaymentValidationError(`${invalidType.name} is not a PDF, JPG, or PNG file.`);
      return;
    }
    const oversized = selected.find((file) => file.size > MAX_PAYMENT_PROOF_BYTES);
    if (oversized) {
      setPaymentValidationError(`${oversized.name} is larger than 15 MB.`);
      return;
    }
    setPaymentValidationError("");
    setPaymentProofFiles(combined);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!confirmInvoice || !confirmAction) return;

    if (["BANK_TRANSFER", "GCASH", "CHECK"].includes(paymentMethod) && paymentProofFiles.length === 0) {
      setPaymentValidationError("Upload at least one payment proof for this payment method.");
      return;
    }

    setPaymentValidationError("");
    const succeeded = await changeInvoiceStatus(confirmInvoice, confirmAction, {
      sendNotification,
      payment: confirmAction === "PAID" ? {
        method: paymentMethod,
        referenceNumber: paymentReference,
        destinationCode: paymentDestination,
        proofFiles: paymentProofFiles,
      } : undefined,
    });

    if (succeeded) handleCloseConfirm();
  };

  useImperativeHandle(
    ref,
    () => ({
      openCreateInvoice: () => {
        openCreateInvoice(null);
      },
    }),
    [openCreateInvoice],
  );

  return (
    <div className={`min-h-screen font-sans ${theme.page}`}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <InvoiceStatistics
          isDark={isDark}
          totalCount={counts.total}
          draftCount={counts.draft}
          issuedCount={counts.issued}
          paidCount={counts.paid}
          cancelledCount={counts.cancelled}
          eligibleShipmentCount={eligibleShipments.length}
          onOpenCreate={() => openCreateInvoice(null)}
        />

        <InvoiceTable
          invoices={mappedInvoices}
          loading={loading}
          onRefresh={fetchInvoicesAndShipments}
          onViewInvoice={openInvoiceDetails}
          onEditInvoice={openEditInvoice}
          onIssueInvoice={(invoice) => handleOpenConfirm(invoice, "ISSUED")}
          onMarkPaid={(invoice) => handleOpenConfirm(invoice, "PAID")}
          onCancelInvoice={(invoice) => handleOpenConfirm(invoice, "CANCELLED")}
          isDark={isDark}
        />
      </main>

      <InvoiceFormModal
        isOpen={isFormOpen}
        loading={loading || isInvoiceSaving}
        mode={formMode}
        shipment={selectedShipment}
        invoice={selectedInvoice}
        trips={trips}
        eligibleShipments={eligibleShipments}
        invoicedShipmentIds={Object.keys(invoiceByShipmentId)}
        user={user}
        submissionError={invoiceSubmitError}
        onClose={closeForm}
        onSubmit={submitInvoice}
        isDark={isDark}
      />

      <InvoiceDetailsModal
        isOpen={isDetailsOpen}
        invoice={selectedInvoice}
        shipment={selectedShipment}
        onClose={closeDetails}
        onEdit={() => {
          if (selectedInvoice)
            openEditInvoice(selectedInvoice, selectedShipment);
        }}
        onIssue={() => handleOpenConfirm(selectedInvoice, "ISSUED")}
        onMarkPaid={() => handleOpenConfirm(selectedInvoice, "PAID")}
        onCancel={() => handleOpenConfirm(selectedInvoice, "CANCELLED")}
        onReversePayment={async () => {
          const reason = window.prompt("Enter the reason for reversing this payment:");
          if (reason) await reversePayment(selectedInvoice, reason);
        }}
        isDark={isDark}
      />

      {isConfirmOpen && (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center p-4 ${isDark ? "bg-slate-950/70 backdrop-blur-sm" : "bg-black/40 backdrop-blur-sm"}`}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
          >
            <div
              className={`border-b px-6 py-5 ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50/80"}`}
            >
              <h3 className="text-lg font-bold">
                {confirmAction === "ISSUED"
                  ? "Issue invoice"
                  : confirmAction === "PAID"
                    ? "Mark invoice as paid"
                    : "Cancel invoice"}
              </h3>
              <p
                className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                {confirmInvoice?.invoiceNumber ||
                  confirmInvoice?.id ||
                  "Selected invoice"}
              </p>
            </div>

            <div className="space-y-5 p-6">
              <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {confirmAction === "PAID"
                  ? "Enter the payment details below."
                  : confirmAction === "ISSUED"
                    ? "Confirm that this invoice is ready to issue."
                    : "Confirm that you want to cancel this invoice."}
              </p>

              <section className="space-y-4">
                {confirmAction === "PAID" && (
                  <div className="grid grid-cols-1 gap-4">
                    <label className="text-sm font-semibold">
                      <span>Payment method</span>
                      <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm ${isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`}>
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="GCASH">GCash</option>
                        <option value="CHECK">Check</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      <span className="flex items-center justify-between gap-3">
                        <span>Reference number</span>
                        <span className={`text-xs font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}>Optional</span>
                      </span>
                      <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={180} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm ${isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`} placeholder="Receipt, transfer, or check number" />
                    </label>
                    <label className="text-sm font-semibold">
                      <span className="flex items-center justify-between gap-3">
                        <span>Destination account</span>
                        <span className={`text-xs font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}>Optional</span>
                      </span>
                      <input value={paymentDestination} onChange={(event) => setPaymentDestination(event.target.value)} maxLength={100} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm ${isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`} placeholder="Bank or clearing account code" />
                    </label>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">Proof of payment</span>
                        <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {paymentMethod === "CASH" ? "Optional" : "Required"}
                        </span>
                      </div>
                      <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm font-semibold transition-colors ${isDark ? "border-slate-600 bg-slate-950 hover:bg-slate-800" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}`}>
                        <FontAwesomeIcon icon={faPaperclip} />
                        Add proof of payment
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          multiple
                          className="sr-only"
                          disabled={isStatusSaving || paymentProofFiles.length >= MAX_PAYMENT_PROOFS}
                          onChange={handlePaymentProofSelection}
                        />
                      </label>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        PDF, JPG or PNG, up to 15 MB each
                      </p>
                      {paymentProofFiles.length > 0 && (
                        <ul className="space-y-1">
                          {paymentProofFiles.map((file, index) => (
                            <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                              <span className="min-w-0 truncate">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                              <button
                                type="button"
                                disabled={isStatusSaving}
                                onClick={() => setPaymentProofFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}
                                className="shrink-0 text-red-600 hover:text-red-500 disabled:opacity-50"
                                aria-label={`Remove ${file.name}`}
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(paymentValidationError || statusError) && (
                        <p role="alert" className="text-sm font-medium text-red-600">
                          {paymentValidationError || statusError}
                        </p>
                      )}
                    </div>
                    <p className={`rounded-lg px-3 py-2.5 text-xs ${isDark ? "bg-slate-800/70 text-slate-300" : "bg-blue-50 text-slate-600"}`}>
                      The payment is recorded in Atlas Transport and sent to Atlas Finance automatically.
                    </p>
                  </div>
                )}
                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      <FontAwesomeIcon icon={faBell} />
                      Notify customer
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </section>
            </div>

            <div
              className={`flex justify-end gap-2 border-t px-6 py-4 ${isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50/60"}`}
            >
              <button
                type="button"
                onClick={handleCloseConfirm}
                disabled={isStatusSaving}
                className={
                  isDark
                    ? "px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                }
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmStatusUpdate}
                disabled={isStatusSaving}
                className={
                  confirmAction === "PAID"
                    ? "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    : confirmAction === "CANCELLED"
                      ? "px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                      : "px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                }
              >
                {isStatusSaving
                  ? "Saving..."
                  : confirmAction === "PAID"
                    ? "Mark as paid"
                    : confirmAction === "ISSUED"
                      ? "Issue invoice"
                      : "Cancel invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default InvoiceBoard;
