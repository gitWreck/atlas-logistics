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
  isDark = false,
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

  console.log("Rendered TripManifestTab with shipments:", shipments);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* HEADER: STATS + CONTROLS */}
      <div
        className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-3 rounded-lg border ${
          isDark
            ? "bg-slate-800/20 border-slate-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        {/* Stats Section */}
        <div className="w-full md:w-auto flex justify-between md:block items-center">
          <div>
            <div
              className={`text-xs font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Total Cargo
            </div>
            <div
              className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {shipments.length + " "}
              <span
                className={`text-sm font-normal ${isDark ? "text-slate-500" : "text-slate-600"}`}
              >
                shipment{shipments.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {/* Mobile Only: Show Selection Count here to save space */}
          {selectedIds.size > 0 && (
            <div className="md:hidden text-xs font-bold text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-500/30">
              {selectedIds.size} Selected
            </div>
          )}
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
              className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 outline-none ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                window.open(
                  `/components/print/labels?tripId=${tripId}`,
                  "_blank",
                )
              }
              className={`text-xs font-bold px-3 py-1.5 rounded flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300"
              }`}
              title="Print All Labels"
            >
              <FontAwesomeIcon icon={faPrint} />
              {/* Label text hidden on small mobile, visible on SM+ */}
              <span className="inline sm:hidden xl:inline">Labels</span>
            </button>

            <button
              onClick={onAddShipment}
              disabled={isLocked}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 whitespace-nowrap flex-1 sm:flex-none"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Shipments</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- BULK ACTION BAR (Scrollable on mobile) --- */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="hidden md:block text-xs font-bold text-blue-400 px-2 whitespace-nowrap">
            {selectedIds.size} Selected
          </div>

          {/* Actions Container - Horizontal Scroll on Mobile */}
          <div className="flex gap-2 w-full overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => handleBulkAction("UNLOAD")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faDolly} /> Unload
            </button>
            <button
              onClick={() => handleBulkAction("LOAD")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isBulkProcessing ? (
                "Processing..."
              ) : (
                <>
                  <FontAwesomeIcon icon={faTruckLoading} /> Load
                </>
              )}
            </button>
            <button
              onClick={() => handleBulkAction("OUT_FOR_DELIVERY")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faTruckFast} /> Out
            </button>
            <button
              onClick={() => handleBulkAction("DELIVERED")}
              disabled={isBulkProcessing || isLocked}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faCheckDouble} /> Delivered
            </button>
          </div>
        </div>
      )}

      {/* TABLE CONTAINER (Horizontal Scroll wrapper) */}
      <div
        className={`border rounded-lg overflow-hidden ${
          isDark
            ? "border-slate-800 bg-slate-900/50"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="overflow-x-auto">
          <table
            className={`w-full text-left text-sm min-w-[600px] md:min-w-0 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            <thead
              className={`uppercase font-bold text-[10px] tracking-wider ${
                isDark
                  ? "bg-slate-950 text-slate-500"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <tr>
                {/* CHECKBOX HEADER */}
                <th
                  className={`px-4 py-3 w-10 text-center sticky left-0 z-10 ${
                    isDark ? "bg-slate-950" : "bg-slate-100"
                  }`}
                >
                  <button
                    onClick={handleSelectAll}
                    disabled={filteredData.length === 0}
                    className={`transition-colors ${isDark ? "hover:text-white" : "hover:text-slate-900"}`}
                  >
                    <FontAwesomeIcon
                      icon={
                        selectedIds.size > 0 &&
                        selectedIds.size === filteredData.length
                          ? faCheckSquare
                          : faSquare
                      }
                      className={
                        selectedIds.size > 0
                          ? "text-blue-500"
                          : isDark
                            ? "text-slate-700"
                            : "text-slate-400"
                      }
                    />
                  </button>
                </th>
                <th className="px-4 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3">Tracking / Customer</th>
                {/* Destination: Hidden on small screens */}
                <th className="hidden sm:table-cell px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th
                  className={`px-4 py-3 text-right sticky right-0 z-10 ${
                    isDark ? "bg-slate-950" : "bg-slate-100"
                  }`}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}
            >
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
                  const isFullyLoaded =
                    (s.loadedCount || 0) >= (s.totalItems || 1);

                  return (
                    <tr
                      key={s.id || idx}
                      className={`transition-colors ${
                        isSelected
                          ? isDark
                            ? "bg-blue-900/10"
                            : "bg-blue-50"
                          : isDark
                            ? "hover:bg-slate-800/50"
                            : "hover:bg-slate-100"
                      }`}
                      onClick={() => handleSelectOne(s.id)}
                    >
                      {/* CHECKBOX ROW */}
                      <td
                        className={`px-4 py-3 text-center sticky left-0 z-10 ${
                          isSelected
                            ? isDark
                              ? "bg-blue-900/10"
                              : "bg-blue-50"
                            : isDark
                              ? "bg-slate-900/50"
                              : "bg-white"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => handleSelectOne(s.id)}>
                          <FontAwesomeIcon
                            icon={isSelected ? faCheckSquare : faSquare}
                            className={
                              isSelected
                                ? "text-blue-500"
                                : isDark
                                  ? "text-slate-700"
                                  : "text-slate-400"
                            }
                          />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`font-bold text-xs font-mono ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {s.trackingNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                          {s.recipient?.name || "Unknown"}
                        </div>
                        {/* Mobile Only: Show City here since column is hidden */}
                        <div className="sm:hidden text-[10px] text-slate-600 italic">
                          {s.recipient?.address.city || "—"}
                        </div>
                      </td>

                      {/* Destination: Hidden on small screens */}
                      <td className="hidden sm:table-cell px-4 py-3 text-xs">
                        {s.recipient?.address.city || "—"}
                      </td>

                      {/* STATUS COL */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 p-2 rounded border ${
                            isFullyLoaded
                              ? isDark
                                ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30"
                                : "bg-emerald-100 text-emerald-700 border-emerald-300"
                              : isDark
                                ? "bg-slate-800 text-slate-500 border-slate-700"
                                : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}
                        >
                          {s.loadedCount || 0} / {s.totalItems || 0}
                        </span>
                      </td>

                      <td
                        className={`px-4 py-3 text-right sticky right-0 z-10 ${
                          isSelected
                            ? isDark
                              ? "bg-blue-900/10"
                              : "bg-blue-50"
                            : isDark
                              ? "bg-slate-900/50"
                              : "bg-white"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onViewPackages && onViewPackages(s)}
                            className={`text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${
                              isDark
                                ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
                                : "bg-slate-100 hover:bg-slate-200 text-blue-600 border-slate-300"
                            }`}
                          >
                            <FontAwesomeIcon icon={faBoxOpen} />
                          </button>
                          <button
                            onClick={() => onUnassign(s)}
                            // className="text-slate-500 hover:text-red-400 p-2"
                            className={`w-8 h-8 text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${
                              isDark
                                ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
                                : "bg-slate-100 hover:bg-slate-200 text-blue-600 border-slate-300"
                            }`}
                            disabled={isLocked}
                          >
                            <FontAwesomeIcon icon={faMinus} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
