import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

export default function ItemSection({
  items,
  onAdd,
  onRemove,
  onChange,
  onToggleTag,
}) {
  return (
    <div className="pt-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          Package Items
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} /> Add Box
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-950 rounded-xl border border-slate-800 p-4 shadow-sm animate-in slide-in-from-left-2 duration-300"
          >
            <div className="flex gap-4 items-start">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-slate-500 font-mono text-xs border border-slate-800 mt-6">
                {idx + 1}
              </div>
              <div className="w-32">
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                  Type
                </label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
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
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                  Description
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none placeholder:text-slate-600"
                  value={item.description}
                  onChange={(e) => onChange(idx, "description", e.target.value)}
                  required
                  placeholder="e.g. Nike Shoes"
                />
              </div>
              <div className="w-24 relative">
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
              </div>
              {items.length > 1 && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="w-9 h-9 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-sm" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-3 pl-12 items-end">
              <div className="w-40 relative">
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                  Declared Value
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
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
                />
                <TagButton
                  active={item.isPerishable}
                  icon={faSnowflake}
                  label="Perishable"
                  color="cyan"
                  onClick={() => onToggleTag(idx, "isPerishable")}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagButton({ active, icon, label, color, onClick }) {
  const colors = {
    amber: "bg-amber-500/10 border-amber-500 text-amber-500",
    cyan: "bg-cyan-500/10 border-cyan-500 text-cyan-500",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${
        active
          ? colors[color]
          : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
      }`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}
