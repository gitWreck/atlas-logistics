import {
  faBan,
  faCheckSquare,
  faPen,
  faSave,
  faSnowflake,
  faSquare,
  faTimes,
  faTrash,
  faWineGlass,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

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
}) => {
  const statusStyles = {
    LOADED: "bg-emerald-900/30 text-emerald-400 border-emerald-500/30",
    RECEIVED: "bg-slate-800 text-slate-400 border-slate-700",
    IN_TRANSIT: "bg-blue-900/30 text-blue-400 border-blue-500/30",
  };

  return (
    <div
      className={`bg-slate-950 border rounded-xl p-4 transition-all group ${
        isEditing
          ? "border-blue-500 ring-1 ring-blue-500/20"
          : isSelected
            ? "border-blue-500/50 bg-blue-900/5"
            : "border-slate-800 hover:border-slate-600"
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="pt-3">
          <button onClick={() => onSelect(idx)}>
            <FontAwesomeIcon
              icon={isSelected ? faCheckSquare : faSquare}
              className={
                isSelected
                  ? "text-blue-500"
                  : "text-slate-700 group-hover:text-slate-500"
              }
            />
          </button>
        </div>
        <div className="h-10 w-10 bg-slate-900 border border-slate-800 rounded-lg flex flex-shrink-0 items-center justify-center text-sm font-mono text-slate-500 font-bold">
          {pkg.sequence || idx + 1}
        </div>

        <div className="flex-1 space-y-2">
          {isEditing ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] uppercase text-slate-500 font-bold">
                  Description
                </label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              {/* ... other edit fields (Type, Weight, Tags) here ... */}
              <div>
                <label className="text-[10px] uppercase text-slate-500 font-bold">
                  Type
                </label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
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
              <div>
                <label className="text-[10px] uppercase text-slate-500 font-bold">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  value={editForm.weight}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      weight: e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-span-2 flex gap-2 pt-1">
                <button
                  onClick={() =>
                    setEditForm((p) => ({
                      ...p,
                      isFragile: !p.isFragile,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${editForm.isFragile ? "bg-amber-500/10 border-amber-500 text-amber-500" : "bg-slate-900 border-slate-700 text-slate-500"}`}
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
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${editForm.isPerishable ? "bg-cyan-500/10 border-cyan-500 text-cyan-500" : "bg-slate-900 border-slate-700 text-slate-500"}`}
                >
                  <FontAwesomeIcon icon={faSnowflake} /> Perishable
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-base font-bold text-slate-200">
                {pkg.description || "Item"}
              </div>
              <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400">
                  {pkg.packagingType || "Box"}
                </span>
                {pkg.isFragile && (
                  <span className="text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 rounded">
                    Fragile
                  </span>
                )}
                {pkg.isPerishable && (
                  <span className="text-cyan-500 font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 rounded">
                    Perishable
                  </span>
                )}
              </div>
              {/* <div className="flex gap-4 mt-1 text-sm font-mono text-slate-400">
                {pkg.weight} <span className="text-xs text-slate-600">kg</span>
                {pkg.declaredValue > 0 && (
                  <span className="text-emerald-500">₱{pkg.declaredValue}</span>
                )}
              </div> */}
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${statusStyles[pkg.status] || statusStyles.RECEIVED}`}
          >
            {pkg.status}
          </span>
          <div className="flex gap-1 mt-1">
            {isEditing ? (
              <>
                <button
                  onClick={onSaveEdit}
                  disabled={isSaving}
                  className="h-8 w-8 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={faSave} />
                </button>
                <button
                  onClick={onCancelEdit}
                  disabled={isSaving}
                  className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onEdit(pkg, idx)}
                  disabled={isLocked || isSaving}
                  className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded flex items-center justify-center disabled:opacity-30"
                >
                  <FontAwesomeIcon
                    icon={isLocked ? faBan : faPen}
                    className="text-xs"
                  />
                </button>
                <button
                  onClick={() => onRemove(idx)}
                  disabled={isLocked || isSaving}
                  className="h-8 w-8 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded flex items-center justify-center disabled:opacity-30"
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
      </div>
    </div>
  );
};
