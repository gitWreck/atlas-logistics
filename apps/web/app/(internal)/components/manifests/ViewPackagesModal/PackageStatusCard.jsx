import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const PackageStatusCard = ({ icon, label, value }) => (
  <div className="bg-slate-800/30 border border-slate-700 px-5 py-3 rounded-xl flex items-center gap-4 flex-1">
    <FontAwesomeIcon icon={icon} className="text-slate-500 text-lg" />
    <div>
      <div className="text-[10px] text-slate-500 font-bold uppercase">
        {label}
      </div>
      <div className="text-base font-bold text-white">{value}</div>
    </div>
  </div>
);
