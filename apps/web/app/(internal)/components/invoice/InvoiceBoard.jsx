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
import { faBell } from "@fortawesome/free-solid-svg-icons";

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
    formMode,
    selectedShipment,
    selectedInvoice,
    openCreateInvoice,
    openEditInvoice,
    openInvoiceDetails,
    closeForm,
    closeDetails,
    submitInvoice,
    changeInvoiceStatus,
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
    setConfirmInvoice(invoice);
    setConfirmAction(action);
    setSendNotification(true);
    setIsConfirmOpen(true);
  };

  const handleCloseConfirm = () => {
    setIsConfirmOpen(false);
    setConfirmInvoice(null);
    setConfirmAction(null);
    setSendNotification(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!confirmInvoice || !confirmAction) return;

    await changeInvoiceStatus(confirmInvoice, confirmAction, {
      sendNotification,
    });

    handleCloseConfirm();
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
        isDark={isDark}
      />

      {isConfirmOpen && (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center p-4 ${isDark ? "bg-slate-950/70 backdrop-blur-sm" : "bg-black/40 backdrop-blur-sm"}`}
        >
          <div
            className={`w-full max-w-md  border shadow-2xl ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
          >
            <div
              className={`px-5 py-4 border-b ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"}`}
            >
              <h3 className="text-base font-bold">
                Confirm{" "}
                {confirmAction === "ISSUED"
                  ? "Issue"
                  : confirmAction === "PAID"
                    ? "Mark as Paid"
                    : "Cancel"}{" "}
                Invoice
              </h3>
              <p
                className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                {confirmInvoice?.invoiceNumber ||
                  confirmInvoice?.id ||
                  "Selected invoice"}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <p className={` ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Are you sure you want to{" "}
                <span className="font-semibold">
                  {confirmAction === "ISSUED"
                    ? "issue"
                    : confirmAction === "PAID"
                      ? "mark this invoice as paid"
                      : "cancel"}
                </span>
                ?
              </p>

              <section className="space-y-3">
                <div>
                  {/* <h3
                    className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    Customer Notification
                  </h3> */}
                  {/* <p
                    className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                  >
                    Choose whether the Firebase Function should send schedule
                    updates to customers.
                  </p> */}
                </div>

                <label
                  className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}
                >
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />

                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      <FontAwesomeIcon icon={faBell} />
                      Notify customers
                    </div>
                  </div>
                </label>
              </section>
            </div>

            <div
              className={`px-5 py-4 border-t flex justify-end gap-2 ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <button
                type="button"
                onClick={handleCloseConfirm}
                className={
                  isDark
                    ? "px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                }
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleConfirmStatusUpdate}
                className={
                  confirmAction === "PAID"
                    ? "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    : confirmAction === "CANCELLED"
                      ? "px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                      : "px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default InvoiceBoard;
