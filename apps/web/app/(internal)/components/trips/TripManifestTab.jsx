"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { getTableTheme } from "@/app/utility/constant/theme";
import { getTableActionClasses } from "@/app/utility/constant/action";

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const theme = getTableTheme(isDark);
  const action = getTableActionClasses(isDark);

  const filteredData = useMemo(() => {
    return shipments.filter((shipment) => {
      return (
        (shipment.trackingNumber || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (shipment.recipient?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    });
  }, [shipments, search]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, shipments]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((shipment) => shipment.id)));
    }
  };

  const handleSelectOne = (id) => {
    const next = new Set(selectedIds);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    setSelectedIds(next);
  };

  const handleBulkAction = async (bulkAction) => {
    if (selectedIds.size === 0) return;

    try {
      setIsBulkProcessing(true);

      await bulkShipmentAction({
        tripId,
        shipmentIds: Array.from(selectedIds),
        action: bulkAction,
      });

      setSelectedIds(new Set());
      onRefresh?.();
    } catch (error) {
      alert("Error processing: " + error.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div
        className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-3 rounded-lg border ${theme.statCard}`}
      >
        <div className="w-full md:w-auto flex justify-between md:block items-center">
          <div>
            <div
              className={`text-xs font-bold uppercase ${theme.cellSecondary}`}
            >
              Total Cargo
            </div>
            <div className={`text-xl font-bold ${theme.headingText}`}>
              {shipments.length}{" "}
              <span className={`text-sm font-normal ${theme.cellSecondary}`}>
                shipment{shipments.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div
              className={`md:hidden text-xs font-bold px-2 py-1 rounded border ${theme.selectedInfo}`}
            >
              {selectedIds.size} Selected
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-48">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <input
              type="text"
              placeholder="Search tracking..."
              className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 outline-none ${theme.input}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                window.open(
                  `/components/print/labels?tripId=${tripId}`,
                  "_blank",
                )
              }
              className={`text-xs font-bold px-3 py-1.5 rounded flex items-center justify-center gap-2 transition-colors flex-1 sm:flex-none border ${action.soft}`}
              title="Print All Labels"
            >
              <FontAwesomeIcon icon={faPrint} />
              <span className="inline sm:hidden xl:inline">Labels</span>
            </button>

            <button
              type="button"
              onClick={onAddShipment}
              disabled={isLocked}
              className={`text-xs font-bold px-3 py-1.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-1 sm:flex-none ${action.solid}`}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Shipments</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className={`p-2 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 ${theme.bulkBar}`}
        >
          <div
            className={`hidden md:block text-xs font-bold px-2 whitespace-nowrap ${theme.bulkBarText}`}
          >
            {selectedIds.size} Selected
          </div>

          <div className="flex gap-2 w-full overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              type="button"
              onClick={() => handleBulkAction("UNLOAD")}
              disabled={isBulkProcessing || isLocked}
              className={`px-3 py-1.5 border text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkNeutral}`}
            >
              <FontAwesomeIcon icon={faDolly} />
              Unload
            </button>

            <button
              type="button"
              onClick={() => handleBulkAction("LOAD")}
              disabled={isBulkProcessing || isLocked}
              className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkLoad}`}
            >
              {isBulkProcessing ? (
                "Processing..."
              ) : (
                <>
                  <FontAwesomeIcon icon={faTruckLoading} />
                  Load
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleBulkAction("OUT_FOR_DELIVERY")}
              disabled={isBulkProcessing || isLocked}
              className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkOut}`}
            >
              <FontAwesomeIcon icon={faTruckFast} />
              Out
            </button>

            <button
              type="button"
              onClick={() => handleBulkAction("DELIVERED")}
              disabled={isBulkProcessing || isLocked}
              className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkDelivered}`}
            >
              <FontAwesomeIcon icon={faCheckDouble} />
              Delivered
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`border rounded-lg overflow-hidden ${theme.container}`}>
        <div className="overflow-x-auto">
          <table
            className={`w-full text-left text-sm min-w-[600px] md:min-w-0 ${theme.tableText}`}
          >
            <thead
              className={`uppercase font-bold text-[10px] tracking-wider ${theme.thead}`}
            >
              <tr>
                <th
                  className={`px-4 py-3 w-10 text-center sticky left-0 z-10 ${theme.stickyHead}`}
                >
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={filteredData.length === 0}
                    className={
                      isDark
                        ? "hover:text-white transition-colors"
                        : "hover:text-slate-900 transition-colors"
                    }
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
                          ? theme.checkboxActive
                          : theme.checkboxIdle
                      }
                    />
                  </button>
                </th>

                <th className="px-4 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3">Tracking / Customer</th>
                <th className="hidden sm:table-cell px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th
                  className={`px-4 py-3 text-right sticky right-0 z-10 ${theme.stickyHead}`}
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody className={`divide-y ${theme.tbodyDivide}`}>
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className={`px-4 py-8 text-center animate-pulse ${theme.emptyText}`}
                  >
                    Loading manifest...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className={`px-4 py-8 text-center italic ${theme.emptyText}`}
                  >
                    No shipments found.
                  </td>
                </tr>
              ) : (
                filteredData.map((shipment, idx) => {
                  const isSelected = selectedIds.has(shipment.id);
                  const loadedCount = shipment.loadedCount || 0;
                  const totalItems = shipment.totalItems || 0;
                  const isFullyLoaded = loadedCount >= (totalItems || 1);

                  return (
                    <tr
                      key={shipment.id || idx}
                      className={`transition-colors ${
                        isSelected ? theme.selectedRow : theme.rowHover
                      }`}
                      onClick={() => handleSelectOne(shipment.id)}
                    >
                      <td
                        className={`px-4 py-3 text-center sticky left-0 z-10 ${
                          isSelected
                            ? theme.stickyCellSelected
                            : theme.stickyCell
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectOne(shipment.id)}
                        >
                          <FontAwesomeIcon
                            icon={isSelected ? faCheckSquare : faSquare}
                            className={
                              isSelected
                                ? theme.checkboxActive
                                : theme.checkboxIdle
                            }
                          />
                        </button>
                      </td>

                      <td
                        className={`px-4 py-3 text-center font-mono text-xs ${theme.cellSecondary}`}
                      >
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3">
                        <div
                          className={`font-bold text-xs font-mono ${theme.cellPrimary}`}
                        >
                          {shipment.trackingNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                          {shipment.recipient?.name || "Unknown"}
                        </div>
                        <div className="sm:hidden text-[10px] text-slate-600 italic">
                          {shipment.recipient?.address.city || "—"}
                        </div>
                      </td>

                      <td
                        className={`hidden sm:table-cell px-4 py-3 text-xs ${theme.cellSecondary}`}
                      >
                        {shipment.recipient?.address.city || "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-2 rounded border ${
                            isFullyLoaded
                              ? theme.countBadgeLoaded
                              : theme.countBadgeDefault
                          }`}
                        >
                          {loadedCount} / {totalItems}
                        </span>
                      </td>

                      <td
                        className={`px-4 py-3 text-right sticky right-0 z-10 ${
                          isSelected
                            ? theme.stickyCellSelected
                            : theme.stickyCell
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onViewPackages?.(shipment)}
                            className={`text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${action.soft}`}
                          >
                            <FontAwesomeIcon icon={faBoxOpen} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onUnassign(shipment)}
                            className={`w-8 h-8 text-xs border px-3 py-1.5 rounded transition-all flex items-center justify-center ${action.soft}`}
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
