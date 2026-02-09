import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRoute, faWarehouse } from "@fortawesome/free-solid-svg-icons";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

export default function RouteSection({ routeInfo, onWarehouseChange }) {
  return (
    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faRoute} /> Shipment Route
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ORIGIN */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-xs font-bold text-blue-400 uppercase">
              Origin Warehouse
            </label>
            {routeInfo.originCode && (
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-1.5 rounded">
                {routeInfo.originCode}
              </span>
            )}
          </div>
          <div className="relative">
            <FontAwesomeIcon
              icon={faWarehouse}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
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

        {/* DESTINATION */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-xs font-bold text-emerald-400 uppercase">
              Destination Warehouse
            </label>
            {routeInfo.destinationCode && (
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 rounded">
                {routeInfo.destinationCode}
              </span>
            )}
          </div>
          <div className="relative">
            <FontAwesomeIcon
              icon={faWarehouse}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer"
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
