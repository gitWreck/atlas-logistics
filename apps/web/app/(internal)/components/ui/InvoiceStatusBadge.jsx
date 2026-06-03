export default function InvoiceStatusBadge({ status, isDark = false }) {
  const normalizedStatus = String(status || "UNKNOWN").toUpperCase();
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
        tone[normalizedStatus] ||
        (isDark
          ? "bg-slate-800 text-slate-300 border-slate-700"
          : "bg-slate-100 text-slate-700 border-slate-200")
      }`}
    >
      {normalizedStatus}
    </span>
  );
}
