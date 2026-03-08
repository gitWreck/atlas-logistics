import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWineGlass, faSnowflake } from "@fortawesome/free-solid-svg-icons";

export default function AddPackageForm({
  newPackage,
  setNewPackage,
  setIsAdding,
  handleAddSave,
  isSaving,
  isDark,
  packagingTypes,
}) {
  const inputClass = `w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${
    isDark
      ? "bg-slate-900 border-slate-700 text-white"
      : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div
      className={`border p-4 rounded-xl space-y-3 ${isDark ? "bg-blue-500/5 border-blue-500/30" : "bg-blue-50 border-blue-200"}`}
    >
      <div
        className={`text-xs font-bold uppercase mb-2 ${isDark ? "text-blue-400" : "text-blue-600"}`}
      >
        New Package Details
      </div>
      <input
        placeholder="Description (e.g. Large Box)"
        className={inputClass}
        value={newPackage.description}
        onChange={(e) =>
          setNewPackage((p) => ({ ...p, description: e.target.value }))
        }
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className={inputClass}
          value={newPackage.packagingType}
          onChange={(e) =>
            setNewPackage((p) => ({ ...p, packagingType: e.target.value }))
          }
        >
          {packagingTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Quantity"
          className={inputClass}
          value={newPackage.quantity}
          onChange={(e) =>
            setNewPackage((p) => ({ ...p, quantity: e.target.value }))
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Value (PHP)"
          className={inputClass}
          value={newPackage.declaredValue}
          onChange={(e) =>
            setNewPackage((p) => ({ ...p, declaredValue: e.target.value }))
          }
        />
        <div className="flex gap-2 items-center">
          <button
            onClick={() =>
              setNewPackage((p) => ({ ...p, isFragile: !p.isFragile }))
            }
            className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              newPackage.isFragile
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
              setNewPackage((p) => ({ ...p, isPerishable: !p.isPerishable }))
            }
            className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              newPackage.isPerishable
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
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => setIsAdding(false)}
          className={`px-4 py-2 text-sm font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          Cancel
        </button>
        <button
          onClick={handleAddSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
