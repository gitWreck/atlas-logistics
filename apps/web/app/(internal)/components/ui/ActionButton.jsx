import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Reusable Button Component for consistency
export const ActionButton = ({
  onClick,
  disabled,
  icon,
  label,
  color = "blue",
}) => {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20",
    emerald: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20",
    amber: "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20",
    red: "bg-red-600 hover:bg-red-500 shadow-red-500/20",
    slate: "bg-slate-700 hover:bg-slate-600 border-slate-600",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:grayscale ${colors[color]}`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
};
