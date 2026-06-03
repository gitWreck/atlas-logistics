export default function InfoBlock({ label, value, isDark = false }) {
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
        {value || "-"}
      </p>
    </div>
  );
}
