"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileInvoiceDollar,
  faSync,
  faSearch,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";

import InvoiceBoardHeader from "./InvoiceBoardHeader";
import InvoiceBoardFilters from "./InvoiceBoardFilters";
import InvoiceStatusBoard from "./unusend/InvoiceStatusBoard";
import InvoiceFormModal from "./InvoiceFormModal";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import { INVOICE_STATUSES } from "@/app/utility/constant/templates";
import InvoiceTable from "./InvoiceTable";

const InvoiceBoard = forwardRef(function InvoiceBoard(
  { user, isDark = false },
  ref,
) {
  const [shipments, setShipments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [formMode, setFormMode] = useState("create");

  const theme = getBoardThemeClasses(isDark);

  const fetchInvoicesAndShipments = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const token = await user.getIdToken();

      const [shipmentsRes, invoicesRes] = await Promise.all([
        fetch("/api/shipments", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
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
      if (!invoicesRes.ok) throw new Error("Failed to fetch invoices");

      const shipmentsData = await shipmentsRes.json();
      const invoicesData = await invoicesRes.json();

      setShipments(shipmentsData.shipments || []);
      setInvoices(invoicesData.invoices || []);
    } catch (err) {
      console.error("Error fetching invoices/shipments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoicesAndShipments();
  }, []);

  const invoiceByShipmentId = useMemo(() => {
    return invoices.reduce((acc, invoice) => {
      if (invoice?.shipmentId) {
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
        shipmentTrackingNumber:
          invoice.shipmentTrackingNumber ||
          shipment?.trackingNumber ||
          shipment?.id ||
          "—",
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

  const filteredInvoices = useMemo(() => {
    return mappedInvoices.filter((invoice) => {
      const searchContent = `
        ${invoice.invoiceNumber || ""}
        ${invoice.shipmentTrackingNumber || ""}
        ${invoice.senderName || ""}
        ${invoice.recipientName || ""}
        ${invoice.routeLabel || ""}
        ${invoice.status || ""}
      `.toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      if (activeFilter !== "ALL" && invoice.status !== activeFilter) {
        return false;
      }

      return true;
    });
  }, [mappedInvoices, searchQuery, activeFilter]);

  const groupedInvoices = useMemo(() => {
    const initialGroups = INVOICE_STATUSES.reduce((acc, status) => {
      acc[status] = [];
      return acc;
    }, {});

    filteredInvoices.forEach((invoice) => {
      const status = INVOICE_STATUSES.includes(invoice.status)
        ? invoice.status
        : "DRAFT";
      initialGroups[status].push(invoice);
    });

    return initialGroups;
  }, [filteredInvoices]);

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

  const handleOpenCreate = (shipment = null) => {
    setFormMode("create");
    setSelectedShipment(shipment);
    setSelectedInvoice(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (invoice) => {
    setFormMode("edit");
    setSelectedInvoice(invoice);
    setSelectedShipment(invoice?.shipment || null);
    setIsFormOpen(true);
  };

  const handleOpenDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setSelectedShipment(invoice?.shipment || null);
    setIsDetailsOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedShipment(null);
    setSelectedInvoice(null);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedInvoice(null);
    setSelectedShipment(null);
  };

  const handleSubmitInvoice = async (payload) => {
    try {
      if (!user) return;

      const token = await user.getIdToken();
      const isEdit = formMode === "edit" && selectedInvoice?.id;

      const res = await fetch(
        isEdit ? `/api/invoices/${selectedInvoice.id}` : "/api/invoices",
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) throw new Error("Failed to save invoice");

      await fetchInvoicesAndShipments();
      handleCloseForm();
    } catch (err) {
      console.error("Error saving invoice:", err);
    }
  };

  const handleInvoiceStatusUpdate = async (invoice, status) => {
    try {
      if (!user || !invoice?.id) return;

      const token = await user.getIdToken();

      const res = await fetch(`/api/invoices/${invoice.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error(`Failed to update invoice to ${status}`);

      await fetchInvoicesAndShipments();

      if (isDetailsOpen && selectedInvoice?.id === invoice.id) {
        setSelectedInvoice((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch (err) {
      console.error("Error updating invoice status:", err);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      openCreateInvoice: () => {
        handleOpenCreate(null);
      },
    }),
    [],
  );

  return (
    <div className={`min-h-screen font-sans ${theme.page}`}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <InvoiceBoardHeader
          isDark={isDark}
          totalCount={counts.total}
          draftCount={counts.draft}
          issuedCount={counts.issued}
          paidCount={counts.paid}
          cancelledCount={counts.cancelled}
          eligibleShipmentCount={eligibleShipments.length}
          onOpenCreate={() => handleOpenCreate(null)}
        />

        <InvoiceTable
          invoices={mappedInvoices}
          loading={loading}
          onRefresh={fetchInvoicesAndShipments}
          onViewInvoice={handleOpenDetails}
          onEditInvoice={handleOpenEdit}
          onIssueInvoice={(invoice) =>
            handleInvoiceStatusUpdate(invoice, "ISSUED")
          }
          onMarkPaid={(invoice) => handleInvoiceStatusUpdate(invoice, "PAID")}
          onCancelInvoice={(invoice) =>
            handleInvoiceStatusUpdate(invoice, "CANCELLED")
          }
          isDark={isDark}
        />
      </main>

      <InvoiceFormModal
        isOpen={isFormOpen}
        mode={formMode}
        shipment={selectedShipment}
        invoice={selectedInvoice}
        onClose={handleCloseForm}
        onSubmit={handleSubmitInvoice}
        isDark={isDark}
      />

      <InvoiceDetailsModal
        isOpen={isDetailsOpen}
        invoice={selectedInvoice}
        shipment={selectedShipment}
        onClose={handleCloseDetails}
        onEdit={() => {
          handleCloseDetails();
          if (selectedInvoice) handleOpenEdit(selectedInvoice);
        }}
        onIssue={() =>
          selectedInvoice &&
          handleInvoiceStatusUpdate(selectedInvoice, "ISSUED")
        }
        onMarkPaid={() =>
          selectedInvoice && handleInvoiceStatusUpdate(selectedInvoice, "PAID")
        }
        onCancel={() =>
          selectedInvoice &&
          handleInvoiceStatusUpdate(selectedInvoice, "CANCELLED")
        }
        isDark={isDark}
      />
    </div>
  );
});

export default InvoiceBoard;
