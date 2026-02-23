import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRoute, faWarehouse } from "@fortawesome/free-solid-svg-icons";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

export default function RouteSection({ routeInfo, onWarehouseChange, isDark = false }) {
  const selectClass = isDark
    ? "w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
    : "w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none appearance-none cursor-pointer";
  return (
    <div className={`p-4 rounded-xl border ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
      <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
        <FontAwesomeIcon icon={faRoute} /> Shipment Route
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className={`text-xs font-bold uppercase ${isDark ? "text-blue-400" : "text-blue-600"}`}>
              Origin Warehouse
            </label>
            {routeInfo.originCode && (
              <span className={`text-[10px] font-mono px-1.5 rounded ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"}`}>
                {routeInfo.originCode}
              </span>
            )}
          </div>
          <div className="relative">
            <FontAwesomeIcon
              icon={faWarehouse}
              className={`absolute left-3 top-2.5 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            />
            <select
              className={selectClass}
              value={routeInfo.origin}
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
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <label className={`text-xs font-bold uppercase ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
              Destination Warehouse
            </label>
            {routeInfo.destinationCode && (
              <span className={`text-[10px] font-mono px-1.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                {routeInfo.destinationCode}
              </span>
            )}
          </div>
          <div className="relative">
            <FontAwesomeIcon
              icon={faWarehouse}
              className={`absolute left-3 top-2.5 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            />
            <select
              className={selectClass.replace("focus:border-blue-500", "focus:border-emerald-500")}
              value={routeInfo.destination}
              onChange={(e) => onWarehouseChange("destination", e.target.value)}
              required
            >
              <option value="">Select Destination...</option>
              {WAREHOUSES.filter((w) => w.code !== routeInfo.originCode).map(
                (w) => (
                  <option key={w.code} value={w.name}>
                    {w.name}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
