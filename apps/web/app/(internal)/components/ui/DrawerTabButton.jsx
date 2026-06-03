import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function DrawerTabButton({ isActive, onClick, icon, label, theme }) {
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
