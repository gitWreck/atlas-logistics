import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
export default function StatusCard({ title, value, icon, color, bg, isDark }) {
  return (
    <div
      className={`p-5 rounded-xl border shadow-sm flex items-start justify-between transition-colors ${
        isDark
          ? "border-slate-700 bg-slate-800/50 hover:border-slate-600"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow"
      }`}
    >
      <div>
        <p
          className={`text-xs font-bold uppercase tracking-wider mb-1 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {title}
        </p>
        <h4
          className={`text-3xl font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}
        >
          {value}
        </h4>
      </div>
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg} ${color}`}
      >
        <FontAwesomeIcon icon={icon} />
      </div>
    </div>
  );
}
