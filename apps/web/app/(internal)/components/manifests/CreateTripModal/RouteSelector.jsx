import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWarehouse, faRoute } from "@fortawesome/free-solid-svg-icons";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

export default function RouteSelector({ formData, onWarehouseChange }) {
  return (
    <div className="space-y-4">
      {/* ORIGIN SELECTOR */}
      <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
            <FontAwesomeIcon icon={faWarehouse} /> Origin Warehouse
          </label>
          {formData.originCode && (
            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-1.5 rounded">
              {formData.originCode}
            </span>
          )}
        </div>
        <select
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
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
      <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-2">
            <FontAwesomeIcon icon={faRoute} /> Destination Warehouse
          </label>
          {formData.destinationCode && (
            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 rounded">
              {formData.destinationCode}
            </span>
          )}
        </div>
        <select
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer"
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
