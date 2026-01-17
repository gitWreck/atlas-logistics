import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
export default function StatusCard({ title, value, icon, color, bg }) {
  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-start justify-between hover:border-slate-700 transition-colors">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          {title}
        </p>
        <h4 className="text-3xl font-bold text-slate-200">{value}</h4>
      </div>
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg} ${color}`}
      >
        <FontAwesomeIcon icon={icon} />
      </div>
    </div>
  );
}
