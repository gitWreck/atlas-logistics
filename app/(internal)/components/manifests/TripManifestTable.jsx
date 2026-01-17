import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCut, faMinus } from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import StatusBadge from "../ui/StatusBadge";

export default function TripManifestTable({
  shipments,
  loading,
  isLocked,
  onSplit,
  onUnassign,
}) {
  const totalItems =
    shipments?.reduce((sum, p) => sum + (p.totalItems || 0), 0) || 0;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[300px]">
      <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
        <h3 className="font-bold text-slate-400 text-sm uppercase">
          Cargo Manifest
        </h3>
        <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono">
          Shipments Count: {totalItems}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-500 font-bold uppercase border-b border-slate-800">
            <tr>
              <th className="p-3">Tracking / ID</th>
              <th className="p-3">Stats</th>
              <th className="p-3">Status</th>
              <th className="p-3">Route</th>
              <th className="p-3">Updated</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="6" className="p-6 text-center text-slate-500">
                  Loading Cargo...
                </td>
              </tr>
            ) : shipments?.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="p-6 text-center text-slate-500 italic"
                >
                  Truck is empty.
                </td>
              </tr>
            ) : (
              shipments?.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-bold text-white">
                      {p.trackingNumber}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {p.id}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>
                      Load: {p.loadedCount}/{p.totalItems}
                    </div>
                    {p.pendingCount > 0 && (
                      <div className="text-red-400 font-bold">
                        Pending: {p.pendingCount}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                      {p.route}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                      {formatFirestoreDate(p.updatedAt)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onSplit(p)}
                        className="text-slate-500 hover:text-amber-400 p-2"
                        disabled={isLocked || (p.totalItems || 0) <= 1}
                      >
                        <FontAwesomeIcon icon={faCut} />
                      </button>
                      <button
                        onClick={() => onUnassign(p)}
                        className="text-slate-500 hover:text-red-400 p-2"
                        disabled={isLocked}
                      >
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
