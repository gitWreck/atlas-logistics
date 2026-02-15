import {
  faArrowsSplitUpAndLeft,
  faDolly,
  faTruckLoading,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const PackageBulkActions = ({
  selectedCount,
  canSplit,
  isLocked,
  isSaving,
  onSplit,
  onStatusChange,
}) => (
  <div className="bg-blue-900/20 border-b border-blue-500/20 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-2">
    <div className="text-xs font-bold text-blue-300">
      {selectedCount} Items Selected
    </div>
    <div className="flex gap-2">
      {canSplit && (
        <button
          onClick={onSplit}
          disabled={isLocked || isSaving}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors mr-auto disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faArrowsSplitUpAndLeft} /> Split
        </button>
      )}
      <button
        onClick={() => onStatusChange("RECEIVED")}
        disabled={isLocked || isSaving}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
      >
        <FontAwesomeIcon icon={faDolly} /> Unload
      </button>
      <button
        onClick={() => onStatusChange("LOADED")}
        disabled={isLocked || isSaving}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50"
      >
        <FontAwesomeIcon icon={faTruckLoading} /> Load
      </button>
    </div>
  </div>
);
