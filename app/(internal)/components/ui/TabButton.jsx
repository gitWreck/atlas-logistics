import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function TabButton({ isActive, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`
        pb-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors
        ${
          isActive
            ? "border-blue-500 text-blue-400"
            : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-800"
        }
      `}
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </button>
  );
}
