import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const PackageStatusCard = ({ icon, label, value, isDark = false }) => (
  <div className={`px-5 py-3 rounded-xl flex items-center gap-4 flex-1 ${
    isDark ? "bg-slate-800/30 border border-slate-700" : "bg-slate-100 border border-slate-200"
  }`}>
    <FontAwesomeIcon icon={icon} className={`text-lg ${isDark ? "text-slate-500" : "text-slate-600"}`} />
    <div>
      <div className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-500" : "text-slate-600"}`}>
        {label}
      </div>
      <div className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{value}</div>
    </div>
  </div>
);
