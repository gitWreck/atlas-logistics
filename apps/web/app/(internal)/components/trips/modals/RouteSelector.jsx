import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWarehouse, faRoute } from "@fortawesome/free-solid-svg-icons";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

export default function RouteSelector({
  formData,
  onWarehouseChange,
  isDark = false,
}) {
  return (
    <div className="space-y-4">
      {/* ORIGIN SELECTOR */}
      <div
        className={`p-3 rounded-lg border ${
          isDark
            ? "bg-slate-950/50 border-slate-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <label
            className={`text-[10px] font-bold uppercase flex items-center gap-2 ${
              isDark ? "text-blue-400" : "text-blue-600"
            }`}
          >
            <FontAwesomeIcon icon={faWarehouse} /> Origin Warehouse
          </label>
          {formData.originCode && (
            <span
              className={`text-[10px] font-mono px-1.5 rounded ${
                isDark
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-blue-100 text-blue-700 border border-blue-200"
              }`}
            >
              {formData.originCode}
            </span>
          )}
        </div>
        <select
          className={`w-full rounded-lg p-2 text-xs outline-none appearance-none cursor-pointer border ${
            isDark
              ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
              : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
          }`}
          value={formData.origin}
          onChange={(e) => onWarehouseChange("origin", e.target.value)}
          required
        >
          <option value="">Select Origin...</option>
          {WAREHOUSES.map((w) => (
            <option key={w.code} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {/* DESTINATION SELECTOR */}
      <div
        className={`p-3 rounded-lg border ${
          isDark
            ? "bg-slate-950/50 border-slate-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <label
            className={`text-[10px] font-bold uppercase flex items-center gap-2 ${
              isDark ? "text-emerald-400" : "text-emerald-600"
            }`}
          >
            <FontAwesomeIcon icon={faRoute} /> Destination Warehouse
          </label>
          {formData.destinationCode && (
            <span
              className={`text-[10px] font-mono px-1.5 rounded ${
                isDark
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              {formData.destinationCode}
            </span>
          )}
        </div>
        <select
          className={`w-full rounded-lg p-2 text-xs outline-none appearance-none cursor-pointer border ${
            isDark
              ? "bg-slate-900 border-slate-700 text-white focus:border-emerald-500"
              : "bg-white border-slate-300 text-slate-900 focus:border-emerald-500"
          }`}
          value={formData.destination}
          onChange={(e) => onWarehouseChange("destination", e.target.value)}
          required
        >
          <option value="">Select Destination...</option>
          {WAREHOUSES.filter((w) => w.code !== formData.originCode).map((w) => (
            <option key={w.code} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
