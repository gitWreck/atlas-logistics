import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

const inputClass = (isDark) =>
  isDark
    ? "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
    : "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:border-blue-500 outline-none";

export default function ItemSection({
  items,
  onAdd,
  onRemove,
  onChange,
  onToggleTag,
  isDark = false,
}) {
  const inp = inputClass(isDark);
  return (
    <div className="pt-2">
      <div className="flex justify-between items-center mb-4">
        <h3
          className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          Package Items
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className={`text-xs border px-4 py-2 rounded-lg flex items-center gap-2 ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-blue-400"
              : "bg-slate-200 hover:bg-slate-300 border-slate-300 text-blue-600"
          }`}
        >
          <FontAwesomeIcon icon={faPlus} /> Item
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 shadow-sm animate-in slide-in-from-left-2 duration-300 ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex gap-4 items-start">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs border mt-6 ${
                  isDark
                    ? "bg-slate-900 text-slate-500 border-slate-800"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {idx + 1}
              </div>
              <div className="w-32">
                <label
                  className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                >
                  Type
                </label>
                <select
                  className={inp}
                  value={item.packagingType}
                  onChange={(e) =>
                    onChange(idx, "packagingType", e.target.value)
                  }
                >
                  {PACKAGING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label
                  className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                >
                  Description
                </label>
                <input
                  type="text"
                  className={`${inp} ${isDark ? "placeholder:text-slate-600" : "placeholder:text-slate-400"}`}
                  value={item.description}
                  onChange={(e) => onChange(idx, "description", e.target.value)}
                  required
                  placeholder="e.g. Nike Shoes"
                />
              </div>
              <div className="w-24 relative">
                <label
                  className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                >
                  Quantity
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className={`${inp} text-right`}
                  value={item.quantity}
                  onChange={(e) => onChange(idx, "quantity", e.target.value)}
                  required
                  placeholder="e.g. 1"
                />
              </div>

              {/* <div className="w-24 relative">
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                  Weight
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-right pr-8 focus:border-blue-500 outline-none"
                  value={item.weight}
                  onChange={(e) => onChange(idx, "weight", e.target.value)}
                  required
                />
                <span className="absolute right-3 top-[29px] text-slate-500 text-xs font-bold pointer-events-none">
                  KG
                </span>
              </div> */}
              {items.length > 1 && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className={`w-9 h-9 flex items-center justify-center hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all ${isDark ? "text-slate-600" : "text-slate-500"}`}
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-sm" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-3 pl-12 items-end">
              <div className="w-40 relative">
                <label
                  className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                >
                  Declared Value
                </label>
                <div className="relative">
                  <span
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isDark ? "text-slate-500" : "text-slate-600"}`}
                  >
                    ₱
                  </span>
                  <input
                    type="number"
                    className={`${inp.replace("focus:border-blue-500", "focus:border-emerald-500")} pl-7`}
                    value={item.declaredValue}
                    onChange={(e) =>
                      onChange(idx, "declaredValue", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <TagButton
                  active={item.isFragile}
                  icon={faWineGlass}
                  label="Fragile"
                  color="amber"
                  onClick={() => onToggleTag(idx, "isFragile")}
                  isDark={isDark}
                />
                <TagButton
                  active={item.isPerishable}
                  icon={faSnowflake}
                  label="Perishable"
                  color="cyan"
                  onClick={() => onToggleTag(idx, "isPerishable")}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagButton({ active, icon, label, color, onClick, isDark = false }) {
  const activeColors = {
    amber: "bg-amber-500/10 border-amber-500 text-amber-500",
    cyan: "bg-cyan-500/10 border-cyan-500 text-cyan-500",
  };
  const inactiveClass = active
    ? activeColors[color]
    : isDark
      ? "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
      : "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${inactiveClass}`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}
