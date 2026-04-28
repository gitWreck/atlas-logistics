function buildInitialForm(shipment, invoice, mode) {
  if (mode === "edit" && invoice) {
    return {
      shipmentId:
        invoice.shipmentId || shipment?.id || shipment.shipmentId || "",
      shipmentTrackingNumber:
        invoice.shipmentTrackingNumber ||
        shipment?.trackingNumber ||
        shipment.shipmentId ||
        shipment?.id ||
        "",
      invoiceNumber: invoice.invoiceNumber || "",
      invoiceDate: invoice.invoiceDate || "",
      dueDate: invoice.dueDate || "",
      billingName: invoice.billingName || shipment?.sender?.name || "",
      billingAddress:
        invoice.billingAddress || shipment?.sender?.formattedAddress || "",
      senderName: invoice.senderName || shipment?.sender?.name || "",
      senderPhone: invoice.senderPhone || shipment?.sender?.phone || "",
      recipientName: invoice.recipientName || shipment?.recipient?.name || "",
      recipientPhone:
        invoice.recipientPhone || shipment?.recipient?.phone || "",
      origin: invoice.origin || shipment?.origin || "",
      destination: invoice.destination || shipment?.destination || "",
      routeLabel:
        invoice.routeLabel ||
        `${shipment?.origin || "Unknown"} → ${shipment?.destination || "Unknown"}`,
      shipmentStatus: invoice.shipmentStatus || shipment?.status || "",
      truckTripId: invoice.truckTripId || shipment?.currentTruckTripId || "",
      totalPackages: invoice.totalPackages || shipment?.packages?.length || 0,
      totalItems: invoice.totalItems || shipment?.totals?.totalItems || 0,
      amount: invoice.amount ?? 0,
      notes: invoice.notes || "",
      status: invoice.status || "DRAFT",
      shipmentSnapshot: invoice.shipmentSnapshot || shipment || null,
    };
  }

  return {
    shipmentId: shipment?.id || "",
    shipmentTrackingNumber: shipment?.trackingNumber || shipment?.id || "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    billingName: shipment?.sender?.name || "",
    billingAddress: shipment?.sender?.formattedAddress || "",
    senderName: shipment?.sender?.name || "",
    senderPhone: shipment?.sender?.phone || "",
    recipientName: shipment?.recipient?.name || "",
    recipientPhone: shipment?.recipient?.phone || "",
    origin: shipment?.origin || "",
    destination: shipment?.destination || "",
    routeLabel: `${shipment?.origin || "Unknown"} → ${shipment?.destination || "Unknown"}`,
    shipmentStatus: shipment?.status || "",
    truckTripId: shipment?.currentTruckTripId || "",
    totalPackages: shipment?.packages?.length || 0,
    totalItems: shipment?.totals?.totalItems || 0,
    amount: 0,
    notes: "",
    status: "DRAFT",
    shipmentSnapshot: shipment || null,
  };
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function StatusBadge({ status, isDark = false }) {
  console.log("Rendering StatusBadge with status:", status, "isDark:", isDark);
  const tone = {
    DRAFT: isDark
      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
      : "bg-amber-50 text-amber-700 border-amber-200",
    ISSUED: isDark
      ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
      : "bg-violet-50 text-violet-700 border-violet-200",
    PAID: isDark
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
      : "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: isDark
      ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
      : "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
        tone[status] ||
        (isDark
          ? "bg-slate-800 text-slate-300 border-slate-700"
          : "bg-slate-100 text-slate-700 border-slate-200")
      }`}
    >
      {status || "UNKNOWN"}
    </span>
  );
}

function InfoBlock({ label, value, isDark = false }) {
  return (
    <div>
      <p
        className={`text-[11px] uppercase tracking-widest font-bold ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`text-sm mt-1 break-words ${
          isDark ? "text-slate-100" : "text-slate-800"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-3 py-1">
      <div className="w-36 shrink-0 font-semibold text-slate-600">{label}</div>
      <div className="text-slate-900">{value || "—"}</div>
    </div>
  );
}

export { formatAmount, StatusBadge, InfoBlock, buildInitialForm, InfoRow };
