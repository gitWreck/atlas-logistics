export function InfoCard({ label, value, isDark = false }) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        isDark
          ? "bg-slate-800/30 border-slate-800"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div
        className={`text-[10px] uppercase font-bold mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
      >
        {label}
      </div>
      <div
        className={`text-sm font-medium truncate ${isDark ? "text-slate-300" : "text-slate-700"}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
