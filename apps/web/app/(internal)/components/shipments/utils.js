import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  let animate = false;

  if (status === "DELIVERED") color = "bg-emerald-500";
  if (status === "CREATED") color = "bg-slate-600";
  if (isDelayed) {
    color = "bg-amber-500";
    animate = true;
  } else if (!["DELIVERED", "CREATED", "COMPLETED"].includes(status)) {
    animate = true;
  }

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {animate && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

function TabButton({ isActive, onClick, icon, label, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        isActive ? theme.tabActive : theme.tabIdle
      }`}
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </button>
  );
}

export { StatusDot, TabButton };
