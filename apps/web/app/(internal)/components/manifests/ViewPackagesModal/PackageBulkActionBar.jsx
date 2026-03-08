import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsSplitUpAndLeft,
  faDolly,
  faTruckLoading,
} from "@fortawesome/free-solid-svg-icons";

export default function PackageBulkActionBar({
  selectedCount,
  canSplit,
  handleSplitClick,
  handleBulkStatusChange,
  isLocked,
  isSaving,
  isDark,
}) {
  return (
    <div
      className={`px-6 py-3 flex items-center justify-between ${
        isDark
          ? "bg-blue-900/20 border-b border-blue-500/20"
          : "bg-blue-50 border-b border-blue-200"
      }`}
    >
      <div
        className={`text-xs font-bold ${isDark ? "text-blue-300" : "text-blue-700"}`}
      >
        {selectedCount} Items Selected
      </div>
      <div className="flex gap-2">
        {canSplit && (
          <button
            onClick={handleSplitClick}
            disabled={isLocked || isSaving}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faArrowsSplitUpAndLeft} /> Split
          </button>
        )}
        <button
          onClick={() => handleBulkStatusChange("RECEIVED")}
          disabled={isLocked || isSaving}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300"
              : "bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700"
          }`}
        >
          <FontAwesomeIcon icon={faDolly} /> Unload
        </button>
        <button
          onClick={() => handleBulkStatusChange("LOADED")}
          disabled={isLocked || isSaving}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors shadow-lg disabled:opacity-50 ${
            isDark
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
          }`}
        >
          <FontAwesomeIcon icon={faTruckLoading} /> Load
        </button>
      </div>
    </div>
  );
}
