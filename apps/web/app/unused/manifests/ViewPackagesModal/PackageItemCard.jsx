import {
  faBan,
  faCheckSquare,
  faCube,
  faPen,
  faSave,
  faSnowflake,
  faSquare,
  faTimes,
  faTrash,
  faWineGlass,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

export const PackageItemCard = ({
  pkg,
  idx,
  isEditing,
  editForm,
  setEditForm,
  isSelected,
  onSelect,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  isLocked,
  isSaving,
  isDark = false,
}) => {
  const statusStyles = isDark
    ? {
        LOADED: "bg-emerald-900/30 text-emerald-400 border-emerald-500/30",
        RECEIVED: "bg-slate-800 text-slate-400 border-slate-700",
        IN_TRANSIT: "bg-blue-900/30 text-blue-400 border-blue-500/30",
      }
    : {
        LOADED: "bg-emerald-100 text-emerald-700 border-emerald-300",
        RECEIVED: "bg-slate-100 text-slate-600 border-slate-300",
        IN_TRANSIT: "bg-blue-100 text-blue-700 border-blue-300",
      };

  const baseCardBg = isDark ? "bg-slate-950" : "bg-white";
  const baseBorder = isDark ? "border-slate-800" : "border-slate-200";

  const cardStateClasses = isEditing
    ? "border-blue-500 ring-1 ring-blue-500/20"
    : isSelected
      ? isDark
        ? "border-blue-500/50 bg-blue-900/5"
        : "border-blue-400 bg-blue-50"
      : baseBorder +
        (isDark ? " hover:border-slate-600" : " hover:border-slate-400");

  const isBulkType = ["Sack", "Bundle", "Roll"].includes(
    editForm.packagingType,
  );

  return (
    <div
      className={`${baseCardBg} border rounded-xl p-3 sm:p-4 transition-all group ${cardStateClasses}`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
        {/* LEFT SIDE: Checkbox, Sequence, Details */}
        <div className="flex items-start gap-3 w-full sm:w-auto flex-1">
          {/* Checkbox */}
          <div className="pt-2 sm:pt-3 shrink-0">
            <button
              onClick={() => onSelect(idx)}
              className="p-1 -ml-1 sm:p-0 sm:ml-0"
            >
              <FontAwesomeIcon
                icon={isSelected ? faCheckSquare : faSquare}
                className={`text-lg sm:text-base ${
                  isSelected
                    ? "text-blue-500"
                    : isDark
                      ? "text-slate-700 group-hover:text-slate-500"
                      : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
            </button>
          </div>

          {/* Sequence Number */}
          <div
            className={`h-10 w-10 rounded-lg flex shrink-0 items-center justify-center text-sm font-mono font-bold mt-1 sm:mt-0 ${
              isDark
                ? "bg-slate-900 border border-slate-800 text-slate-500"
                : "bg-slate-100 border border-slate-200 text-slate-600"
            }`}
          >
            {pkg.sequence || idx + 1}
          </div>

          {/* Details / Edit Form */}
          <div className="flex-1 w-full space-y-2 mt-1 sm:mt-0">
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="sm:col-span-2">
                  <label
                    className={`text-[10px] uppercase font-bold ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    Description
                  </label>
                  <input
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label
                    className={`text-[10px] uppercase font-bold ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    Type
                  </label>
                  <select
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                    value={editForm.packagingType}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        packagingType: e.target.value,
                      })
                    }
                  >
                    {PACKAGING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* <div>
                  <label
                    className={`text-[10px] uppercase font-bold ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                    value={editForm.weight}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        weight: e.target.value,
                      })
                    }
                  />
                </div> */}

                {/* ✅ NEW: Quantity Input (Only for Bulk/Sack) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Quantity {isBulkType ? "(Pieces)" : ""}
                  </label>
                  <input
                    type="number"
                    disabled={!isBulkType} // 🔒 Lock for non-bulk types
                    className={`w-full px-3 py-2 rounded-lg border text-sm transition-opacity ${
                      !isBulkType ? "opacity-50 cursor-not-allowed" : ""
                    } ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"}`}
                    value={isBulkType ? editForm.quantity : 1}
                    onChange={(e) =>
                      setEditForm({ ...editForm, quantity: e.target.value })
                    }
                    placeholder={isBulkType ? "Enter pieces..." : "1"}
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() =>
                      setEditForm((p) => ({
                        ...p,
                        isFragile: !p.isFragile,
                      }))
                    }
                    className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 ${
                      editForm.isFragile
                        ? "bg-amber-500/10 border-amber-500 text-amber-500"
                        : isDark
                          ? "bg-slate-900 border-slate-700 text-slate-500"
                          : "bg-slate-100 border-slate-300 text-slate-600"
                    }`}
                  >
                    <FontAwesomeIcon icon={faWineGlass} /> Fragile
                  </button>
                  <button
                    onClick={() =>
                      setEditForm((p) => ({
                        ...p,
                        isPerishable: !p.isPerishable,
                      }))
                    }
                    className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 ${
                      editForm.isPerishable
                        ? "bg-cyan-500/10 border-cyan-500 text-cyan-500"
                        : isDark
                          ? "bg-slate-900 border-slate-700 text-slate-500"
                          : "bg-slate-100 border-slate-300 text-slate-600"
                    }`}
                  >
                    <FontAwesomeIcon icon={faSnowflake} /> Perishable
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`text-sm sm:text-base font-bold break-words pr-2 ${
                    isDark ? "text-slate-200" : "text-slate-900"
                  }`}
                >
                  {pkg.description || "Item"}
                </div>
                <div
                  className={`flex flex-wrap gap-2 items-center text-[10px] sm:text-xs ${
                    isDark ? "text-slate-500" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`px-2 py-0.5 rounded border ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-slate-400"
                        : "bg-slate-100 border-slate-300 text-slate-600"
                    }`}
                  >
                    {pkg.packagingType || "Box"}
                  </span>
                  {pkg.isFragile && (
                    <span className="text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      Fragile
                    </span>
                  )}
                  {pkg.isPerishable && (
                    <span className="text-cyan-500 font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                      Perishable
                    </span>
                  )}
                  {/* Only show quantity if it's more than 1 or a bulk type */}
                  {(pkg.quantity > 1 || isBulkType) && (
                    <span className="text-blue-500 font-bold">
                      <FontAwesomeIcon icon={faCube} className="mr-1" />{" "}
                      {pkg.quantity || 1} Pcs
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Status & Actions */}
        <div
          className={`flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 ${
            isDark ? "border-slate-800/50" : "border-slate-200"
          } ${isEditing ? "hidden sm:flex" : "flex"}`}
        >
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${
              statusStyles[pkg.status] || statusStyles.RECEIVED
            }`}
          >
            {pkg.status.replaceAll("_", " ")}
          </span>
          <div className="flex gap-2 sm:gap-1 mt-0 sm:mt-1">
            {isEditing ? (
              <>
                <button
                  onClick={onSaveEdit}
                  disabled={isSaving}
                  className="h-8 sm:w-8 px-4 sm:px-0 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center text-xs sm:text-sm font-bold disabled:opacity-50"
                >
                  {/* <FontAwesomeIcon icon={faSave} className="sm:hidden mr-2" /> */}
                  <span className="sm:hidden">Save</span>
                  <FontAwesomeIcon icon={faSave} className="hidden sm:block" />
                </button>
                <button
                  onClick={onCancelEdit}
                  disabled={isSaving}
                  className={`h-8 sm:w-8 px-4 sm:px-0 rounded flex items-center justify-center text-xs sm:text-sm font-bold disabled:opacity-50 ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                  }`}
                >
                  <span className="sm:hidden">Cancel</span>
                  <FontAwesomeIcon icon={faTimes} className="hidden sm:block" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onEdit(pkg, idx)}
                  disabled={isLocked || isSaving}
                  className={`h-8 w-10 sm:w-8 rounded flex items-center justify-center disabled:opacity-30 ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                  }`}
                >
                  <FontAwesomeIcon
                    icon={isLocked ? faBan : faPen}
                    className="text-xs"
                  />
                </button>
                <button
                  onClick={() => onRemove(idx)}
                  disabled={isLocked || isSaving}
                  className={`h-8 w-10 sm:w-8 rounded flex items-center justify-center disabled:opacity-30 ${
                    isDark
                      ? "bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                      : "bg-slate-200 hover:bg-red-50 text-slate-600 hover:text-red-600"
                  }`}
                >
                  <FontAwesomeIcon
                    icon={isLocked ? faBan : faTrash}
                    className="text-xs"
                  />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile-only Edit Actions (below form) */}
        {isEditing && (
          <div
            className={`sm:hidden flex w-full gap-2 mt-2 pt-3 border-t ${
              isDark ? "border-slate-800/50" : "border-slate-200"
            }`}
          >
            <button
              onClick={onCancelEdit}
              disabled={isSaving}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center text-xs font-bold ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              } disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              onClick={onSaveEdit}
              disabled={isSaving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center text-xs font-bold disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faSave} className="mr-2" /> Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
