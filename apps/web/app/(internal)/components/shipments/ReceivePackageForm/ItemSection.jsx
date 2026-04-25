import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";

const PACKAGING_TYPES = [
  "Box",
  "Sack",
  "Crate",
  "Bundle",
  "Roll",
  "Envelope",
  "Can",
  "Pail Bucket",
  "Drum",
];

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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h3
          className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          Package Items
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className={`text-xs border px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-blue-400"
              : "bg-slate-200 hover:bg-slate-300 border-slate-300 text-blue-600"
          }`}
        >
          <FontAwesomeIcon icon={faPlus} /> Item
        </button>
      </div>

      {/* ITEMS LIST */}
      <div className="space-y-3 sm:space-y-4">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 shadow-sm animate-in slide-in-from-left-2 duration-300 ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            {/* --- MOBILE HEADER (Badge + Delete) --- */}
            <div className="flex justify-between items-center mb-3 sm:hidden">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs border ${
                  isDark
                    ? "bg-slate-900 text-slate-500 border-slate-800"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {idx + 1}
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className={`w-8 h-8 flex items-center justify-center hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all ${
                    isDark ? "text-slate-600" : "text-slate-500"
                  }`}
                >
                  <FontAwesomeIcon icon={faTrash} className="text-sm" />
                </button>
              )}
            </div>

            <div className="flex gap-4 items-start w-full">
              {/* --- DESKTOP BADGE --- */}
              <div
                className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs border mt-6 shrink-0 ${
                  isDark
                    ? "bg-slate-900 text-slate-500 border-slate-800"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {idx + 1}
              </div>

              {/* --- FORM FIELDS --- */}
              <div className="flex-1 w-full space-y-3 sm:space-y-4">
                {/* ROW 1: Description, Type, Quantity */}
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-4">
                  {/* Description (Full width mobile, 6 cols desktop) */}
                  <div className="col-span-2 sm:col-span-6">
                    <label
                      className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                    >
                      Description
                    </label>
                    <input
                      type="text"
                      className={`${inp} ${isDark ? "placeholder:text-slate-600" : "placeholder:text-slate-400"}`}
                      value={item.description}
                      onChange={(e) =>
                        onChange(idx, "description", e.target.value)
                      }
                      required
                      placeholder="e.g. Nike Shoes"
                    />
                  </div>

                  {/* Type (Half width mobile, 3 cols desktop) */}
                  <div className="col-span-1 sm:col-span-3">
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

                  {/* Quantity (Half width mobile, 3 cols desktop) */}
                  <div className="col-span-1 sm:col-span-3 relative">
                    <label
                      className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                    >
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className={`${inp} text-left sm:text-right`}
                      value={item.quantity}
                      onChange={(e) =>
                        onChange(idx, "quantity", e.target.value)
                      }
                      required
                      placeholder="e.g. 1"
                    />
                  </div>
                </div>

                {/* ROW 2: Declared Value & Tags */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end">
                  {/* Declared Value */}
                  <div className="w-full sm:w-1/3">
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
                  <div className="w-full sm:w-1/3">
                    <label
                      className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                    >
                      Pack
                    </label>
                    <select
                      className={inp}
                      value={item.packagingGroup}
                      onChange={(e) =>
                        onChange(idx, "packagingGroup", e.target.value)
                      }
                    >
                      {/* <option value="">Select Pack</option> */}
                      <option value="SINGLE">Single</option>
                      <option value="BULK">Pack</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div className="w-full sm:w-2/3 flex flex-wrap gap-2">
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

              {/* --- DESKTOP DELETE BUTTON --- */}
              {items.length > 1 && (
                <div className="hidden sm:block mt-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className={`w-9 h-9 flex items-center justify-center hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all ${
                      isDark ? "text-slate-600" : "text-slate-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-sm" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- SUB-COMPONENT ---
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
      // Added flex-1 sm:flex-none to stretch buttons on mobile, but keep content size on desktop
      className={`flex-1 sm:flex-none justify-center px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${inactiveClass}`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}
