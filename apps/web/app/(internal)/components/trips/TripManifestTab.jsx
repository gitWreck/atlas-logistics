import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faBoxOpen,
  faPrint,
  faCheckSquare,
  faSquare,
  faTruckLoading,
  faDolly,
  faMinus,
  faTruckFast,
  faCheckDouble,
} from "@fortawesome/free-solid-svg-icons";
import { bulkShipmentAction } from "@/app/utility/FirebaseFunctions";

export default function TripManifestTab({
  shipments,
  loading,
  isLocked,
  onAddShipment,
  onViewPackages,
  onUnassign,
  tripId,
  onRefresh,
}) {
  const [search, setSearch] = useState("");

  // --- SELECTION STATE ---
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    return shipments.filter((s) => {
      const matchesSearch =
        (s.trackingNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.recipient?.name || "").toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [shipments, search]);

  // --- SELECTION HANDLERS ---
  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set()); // Deselect all
    } else {
      setSelectedIds(new Set(filteredData.map((s) => s.id))); // Select all visible
    }
  };

  const handleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // --- BULK ACTION HANDLER ---
  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;

    try {
      setIsBulkProcessing(true);

      await bulkShipmentAction({
        tripId: tripId,
        shipmentIds: Array.from(selectedIds),
        action: action, // "LOAD" or "UNLOAD"
      });

      setSelectedIds(new Set()); // Clear selection
      if (onRefresh) onRefresh(); // Reload table data
    } catch (error) {
      alert("Error processing: " + error.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* HEADER: STATS + CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-slate-800/20 p-3 rounded-lg border border-slate-800">
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase">
            Total Cargo
          </div>
          <div className="text-xl font-bold text-white">
            {shipments.length}{" "}
            <span className="text-sm font-normal text-slate-500">
              shipments
            </span>
          </div>
        </div>

        {/* CONTROLS ROW */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <input
              type="text"
              placeholder="Search tracking..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
              title="Print All Labels"
            >
              <FontAwesomeIcon icon={faPrint} />
              <span className="hidden xl:inline">Labels</span>
            </button>

            <button
              onClick={onAddShipment}
              disabled={isLocked}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Shipments</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- BULK ACTION BAR (Visible when items selected) --- */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="text-xs font-bold text-blue-400 px-2">
            {selectedIds.size} Selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction("UNLOAD")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faDolly} /> Unload
            </button>
            <button
              onClick={() => handleBulkAction("LOAD")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isBulkProcessing ? (
                "Processing..."
              ) : (
                <>
                  <FontAwesomeIcon icon={faTruckLoading} /> Load
                </>
              )}
            </button>
            {/* --- NEW: OUT FOR DELIVERY --- */}
            <button
              onClick={() => handleBulkAction("OUT_FOR_DELIVERY")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faTruckFast} /> Out
            </button>

            {/* --- NEW: DELIVERED --- */}
            <button
              onClick={() => handleBulkAction("DELIVERED")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faCheckDouble} /> Delivered
            </button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
            <tr>
              {/* CHECKBOX HEADER */}
              <th className="px-4 py-3 w-10 text-center">
                <button
                  onClick={handleSelectAll}
                  disabled={filteredData.length === 0}
                  className="hover:text-white transition-colors"
                >
                  <FontAwesomeIcon
                    icon={
                      selectedIds.size > 0 &&
                      selectedIds.size === filteredData.length
                        ? faCheckSquare
                        : faSquare
                    }
                    className={
                      selectedIds.size > 0 ? "text-blue-500" : "text-slate-700"
                    }
                  />
                </button>
              </th>
              <th className="px-4 py-3 w-10 text-center">#</th>
              <th className="px-4 py-3">Tracking / Customer</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3 text-center">Status</th>{" "}
              {/* Added Status Col */}
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/50">
            {loading ? (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 py-8 text-center text-slate-500 animate-pulse"
                >
                  Loading manifest...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 py-8 text-center text-slate-500 italic"
                >
                  No shipments found.
                </td>
              </tr>
            ) : (
              filteredData.map((s, idx) => {
                const isSelected = selectedIds.has(s.id);
                // Calculate mini-status based on loadedCount vs total
                const isFullyLoaded =
                  (s.loadedCount || 0) >= (s.totalItems || 1);

                return (
                  <tr
                    key={s.id || idx}
                    className={`transition-colors ${isSelected ? "bg-blue-900/10" : "hover:bg-slate-800/50"}`}
                    onClick={() => handleSelectOne(s.id)} // Click row to select
                  >
                    {/* CHECKBOX ROW */}
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button onClick={() => handleSelectOne(s.id)}>
                        <FontAwesomeIcon
                          icon={isSelected ? faCheckSquare : faSquare}
                          className={
                            isSelected ? "text-blue-500" : "text-slate-700"
                          }
                        />
                      </button>
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-white text-xs font-mono">
                        {s.trackingNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                        {s.recipient?.name || "Unknown"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.destinationCode || "—"}
                    </td>

                    {/* STATUS COL */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          isFullyLoaded
                            ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}
                      >
                        {s.loadedCount || 0} / {s.totalItems || 0}
                      </span>
                    </td>

                    <td
                      className="px-4 py-3 text-right gap-2 flex justify-end "
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onViewPackages && onViewPackages(s)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-1.5 rounded transition-all flex items-center gap-1 ml-auto"
                      >
                        <FontAwesomeIcon icon={faBoxOpen} />
                      </button>
                      <button
                        // onClick={() => onViewPackages && onViewPackages(s)} // <--- Trigger Modal Here
                        onClick={() => onUnassign(s)}
                        className="text-slate-500 hover:text-red-400 p-2"
                        disabled={isLocked}
                      >
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
