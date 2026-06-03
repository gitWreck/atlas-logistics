"use client";

import React, { useState, useMemo, useEffect } from "react";
import ReleaseToCheckerModal from "../shipments/modals/ReleaseToCheckerModal";
import { isEligibleForCheckerRelease } from "@/app/utility/checkerRelease";
import { isTripReleaseEligible } from "@/app/utility/tripLifecycle";
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
  faFileInvoiceDollar,
  faReceipt,
} from "@fortawesome/free-solid-svg-icons";
import { bulkShipmentAction } from "@/app/utility/FirebaseFunctions";
import { getTableTheme } from "@/app/utility/constant/theme";
import { getTableActionClasses } from "@/app/utility/constant/action";
import { packageLabelUrl } from "@/app/utility/constant/templates";
import { updatedBy } from "@/app/utility/utilities";
import StatusBadge from "../ui/StatusBadge";
import TablePaginationFooter from "../ui/TablePaginationFooter";
import TripDeliveryPoolSummary from "./TripDeliveryPoolSummary";

export default function TripManifestTab({
  shipments = [],
  loading,
  isLocked,
  onAddShipment,
  onViewPackages,
  onUnassign,
  tripId,
  tripStatus = null,
  tripReconciledAt = null,
  onRefresh,
  isDark = false,

  // add these
  onCreateInvoice,
  onViewInvoice,
  profile,
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [manifestLimit, setManifestLimit] = useState("50");
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  const theme = getTableTheme(isDark);
  const action = getTableActionClasses(isDark);

  const canReleaseShipments = ["manager", "admin"].includes(
    String(profile?.role || "").toLowerCase(),
  );

  const releaseTargetShipments = useMemo(() => {
    const pool =
      selectedIds.size > 0
        ? shipments.filter((s) => selectedIds.has(s.id))
        : shipments;
    return pool.filter((s) => isEligibleForCheckerRelease(s.status));
  }, [shipments, selectedIds]);

  const tripReleaseGate = useMemo(
    () =>
      isTripReleaseEligible({
        status: tripStatus,
        reconciledAt: tripReconciledAt,
      }),
    [tripStatus, tripReconciledAt],
  );

  const rowAction = {
    print: isDark
      ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/30"
      : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
    view: isDark
      ? "bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/30"
      : "bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200",
    invoice: isDark
      ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200",
    createInvoice: isDark
      ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200",
    remove: isDark
      ? "bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200",
  };

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return shipments.filter((shipment) => {
      return (
        String(shipment.shipmentId || "")
          .toLowerCase()
          .includes(keyword) ||
        String(shipment.recipient?.name || "")
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [shipments, search]);

  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [search, shipments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [manifestLimit]);

  const itemsPerPage =
    manifestLimit === "all"
      ? Math.max(filteredData.length, 1)
      : Number(manifestLimit) || 50;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedData = useMemo(() => {
    return filteredData.slice(pageStartIndex, pageStartIndex + itemsPerPage);
  }, [filteredData, itemsPerPage, pageStartIndex]);

  const isAllSelected =
    filteredData.length > 0 && selectedIds.size === filteredData.length;

  const getShipmentInvoice = (shipment) => {
    const hasActiveInvoice =
      shipment.invoiceStatus !== "CANCELLED" &&
      (shipment.hasInvoice || Boolean(shipment.invoiceId));

    return {
      hasInvoice: hasActiveInvoice,
      invoiceId: shipment.invoiceId,
      invoiceNumber: shipment.invoiceNumber,
      invoiceStatus: shipment.invoiceStatus,
    };
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
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
        updatedBy: updatedBy(profile),
      });

      setSelectedIds(new Set());
      onRefresh?.();
    } catch (error) {
      alert("Error processing: " + error.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const renderBulkActions = () => (
    <div className="grid grid-cols-2 sm:flex gap-2 w-full">
      <button
        type="button"
        onClick={() => handleBulkAction("UNLOAD")}
        disabled={isBulkProcessing || isLocked}
        className={`px-3 py-2 border text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkNeutral}`}
      >
        <FontAwesomeIcon icon={faDolly} />
        Unload
      </button>

      <button
        type="button"
        onClick={() => handleBulkAction("LOAD")}
        disabled={isBulkProcessing || isLocked}
        className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkLoad}`}
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
        className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkOut}`}
      >
        <FontAwesomeIcon icon={faTruckFast} />
        Out
      </button>

      <button
        type="button"
        onClick={() => handleBulkAction("DELIVERED")}
        disabled={isBulkProcessing || isLocked}
        className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${action.bulkDelivered}`}
      >
        <FontAwesomeIcon icon={faCheckDouble} />
        Delivered
      </button>
    </div>
  );

  return (
    <>
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <TripDeliveryPoolSummary shipments={shipments} isDark={isDark} />

      {/* Header */}
      <div className={`p-4 rounded-2xl border ${theme.statCard}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div
                className={`text-xs font-bold uppercase ${theme.cellSecondary}`}
              >
                Total Shipments
              </div>

              <div className={`text-2xl font-bold ${theme.headingText}`}>
                {shipments.length}{" "}
                {/* <span className={`text-sm font-normal ${theme.cellSecondary}`}>
                  shipment{shipments.length > 1 ? "s" : ""}
                </span> */}
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div
                className={`lg:hidden text-xs font-bold px-3 py-1.5 rounded-full border ${theme.selectedInfo}`}
              >
                {selectedIds.size} selected
              </div>
            )}
          </div>

          {/* <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto"> */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] gap-2 w-full">
            {/* <div className="relative flex-1 lg:w-64"> */}
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
              <FontAwesomeIcon
                icon={faSearch}
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${theme.inputIcon}`}
              />

              <input
                type="text"
                placeholder="Search tracking or recipient..."
                // className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-blue-500 outline-none ${theme.input}`}
                className={`w-full border rounded-lg pl-9 pr-3 py-1.5 text-xs h-8 leading-none focus:border-blue-500 outline-none ${theme.input}`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 flex-wrap">
              {canReleaseShipments && (
                <button
                  type="button"
                  onClick={() => setIsReleaseModalOpen(true)}
                  disabled={
                    isLocked ||
                    releaseTargetShipments.length === 0 ||
                    !tripReleaseGate.eligible
                  }
                  className={`text-xs font-bold px-3 py-1.5 h-8 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap ${isDark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                  title={
                    !tripReleaseGate.eligible
                      ? tripReleaseGate.reason
                      : selectedIds.size > 0
                        ? `Release ${releaseTargetShipments.length} selected shipment(s) for checker delivery`
                        : `Release all eligible shipments on this trip (${releaseTargetShipments.length})`
                  }
                >
                  <FontAwesomeIcon icon={faBoxOpen} />
                  Release shipment(s)
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/components/print/labels?tripId=${tripId}&mode=individual`,
                    "_blank",
                  )
                }
                // className={`text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors border ${action.soft}`}
                className={`text-xs font-bold px-3 py-1.5 h-8 rounded-lg flex items-center justify-center gap-2 transition-colors ${action.soft}`}
                title="Print All Labels"
              >
                <FontAwesomeIcon icon={faPrint} />
                Labels
              </button>

              <button
                type="button"
                onClick={onAddShipment}
                disabled={isLocked}
                // className={`text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${action.solid}`}
                className={`text-xs font-bold px-3 py-1.5 h-8 rounded-lg flex items-center justify-center gap-2 transition-colors ${action.solid}`}
              >
                <FontAwesomeIcon icon={faPlus} />
                Shipments
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className={`p-3 rounded-2xl border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 animate-in slide-in-from-top-2 ${theme.bulkBar}`}
        >
          <div className={`text-xs font-bold ${theme.bulkBarText}`}>
            {selectedIds.size} selected
          </div>

          {renderBulkActions()}
        </div>
      )}

      {/* Mobile Cards */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div
            className={`rounded-2xl border px-4 py-8 text-center animate-pulse ${theme.container} ${theme.emptyText}`}
          >
            Loading manifest...
          </div>
        ) : filteredData.length === 0 ? (
          <div
            className={`rounded-2xl border px-4 py-8 text-center italic ${theme.container} ${theme.emptyText}`}
          >
            No shipments found.
          </div>
        ) : (
          paginatedData.map((shipment, idx) => {
            console.log("shipemnt data: ", shipment);

            const isSelected = selectedIds.has(shipment.id);
            const loadedCount = shipment.loadedCount || 0;
            const totalItems = shipment.totals.totalContentQty || 0;
            const isFullyLoaded = loadedCount >= (totalItems || 1);
            const shipmentStatus = shipment.status || "UNKNOWN";

            return (
              <div
                key={shipment.id || idx}
                className={`rounded-2xl border p-4 transition-colors ${
                  isSelected ? theme.selectedRow : theme.container
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectOne(shipment.id)}
                    className="pt-1"
                  >
                    <FontAwesomeIcon
                      icon={isSelected ? faCheckSquare : faSquare}
                      className={
                        isSelected ? theme.checkboxActive : theme.checkboxIdle
                      }
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-bold text-sm font-mono break-all ${theme.cellPrimary}`}
                    >
                      {shipment.shipmentId}
                    </div>

                    <div
                      className={`text-sm mt-1 truncate ${theme.cellSecondary}`}
                    >
                      {shipment.recipient?.name || "Unknown"}
                    </div>

                    <div className="hidden">
                      {shipment.recipient?.address?.city || "—"}
                    </div>

                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-sm font-medium ${theme.cellSecondary}`}
                      >
                        {shipment.recipient?.address?.city || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${
                        isFullyLoaded
                          ? theme.countBadgeLoaded
                          : theme.countBadgeDefault
                      }`}
                    >
                      {loadedCount} / {totalItems}
                    </span>

                    <StatusBadge status={shipmentStatus} isDark={isDark} />
                  </div>
                </div>

                {/* <div className="mt-4 grid grid-cols-3 gap-2"> */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        packageLabelUrl(shipment.shipmentId),
                        "_blank",
                      )
                    }
                    className={`text-xs border px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${rowAction.print}`}
                  >
                    <FontAwesomeIcon icon={faPrint} />
                    Print
                  </button>

                  <button
                    type="button"
                    onClick={() => onViewPackages?.(shipment)}
                    className={`text-xs border px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${rowAction.view}`}
                  >
                    <FontAwesomeIcon icon={faBoxOpen} />
                    View
                  </button>

                  {getShipmentInvoice(shipment).hasInvoice ? (
                    <button
                      type="button"
                      onClick={() => onViewInvoice?.(shipment)}
                      className={`text-xs border px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${rowAction.invoice}`}
                    >
                      <FontAwesomeIcon icon={faReceipt} />
                      Invoice
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCreateInvoice?.(shipment)}
                      className={`text-xs border px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${rowAction.createInvoice}`}
                    >
                      <FontAwesomeIcon icon={faFileInvoiceDollar} />
                      Invoice
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onUnassign(shipment)}
                    className={`text-xs border px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${rowAction.remove}`}
                    disabled={isLocked}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && filteredData.length > 0 && (
        <div
          className={`block lg:hidden border rounded-2xl overflow-hidden ${theme.container}`}
        >
          <TablePaginationFooter
            totalItems={filteredData.length}
            currentPage={safeCurrentPage}
            itemsPerPage={itemsPerPage}
            totalPages={totalPages}
            limitValue={manifestLimit}
            limitTitle="Manifest rows per page"
            onLimitChange={setManifestLimit}
            onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
            onNext={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            theme={theme}
          />
        </div>
      )}

      {/* Desktop Table */}
      <div
        className={`hidden lg:block border rounded-2xl overflow-hidden ${theme.container}`}
      >
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-sm ${theme.tableText}`}>
            <thead
              className={`uppercase font-bold text-[10px] tracking-wider ${theme.thead}`}
            >
              <tr>
                <th
                  className={`px-4 py-3 w-10 text-center ${theme.stickyHead}`}
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
                      icon={isAllSelected ? faCheckSquare : faSquare}
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
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-center">Shipment Status</th>
                <th className="px-4 py-3 text-center">Loaded Qty</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${theme.tbodyDivide}`}>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className={`px-4 py-8 text-center animate-pulse ${theme.emptyText}`}
                  >
                    Loading manifest...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className={`px-4 py-8 text-center italic ${theme.emptyText}`}
                  >
                    No shipments found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((shipment, idx) => {
                  const isSelected = selectedIds.has(shipment.id);
                  const loadedCount = shipment.loadedCount || 0;
                  const totalItems = shipment.totals.totalContentQty || 0;
                  const isFullyLoaded = loadedCount >= (totalItems || 1);
                  const shipmentStatus = shipment.status || "UNKNOWN";

                  return (
                    <tr
                      key={shipment.id || idx}
                      className={`transition-colors ${
                        isSelected ? theme.selectedRow : theme.rowHover
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
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
                        {pageStartIndex + idx + 1}
                      </td>

                      <td className="px-4 py-3">
                        <div
                          className={`font-bold text-xs font-mono ${theme.cellPrimary}`}
                        >
                          {shipment.shipmentId}
                        </div>
                        <div
                          className={`text-[11px] truncate max-w-[180px] ${theme.cellSecondary}`}
                        >
                          {shipment.recipient?.name || "Unknown"}
                        </div>
                      </td>

                      <td
                        className={`px-4 py-3 text-xs ${theme.cellSecondary}`}
                      >
                        {shipment.recipient?.address?.city || "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={shipmentStatus} isDark={isDark} />
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

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                packageLabelUrl(shipment.shipmentId),
                                "_blank",
                              )
                            }
                            className={`text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${rowAction.print}`}
                            title="Print Label"
                          >
                            <FontAwesomeIcon icon={faPrint} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onViewPackages?.(shipment)}
                            className={`text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${rowAction.view}`}
                            title="View Packages"
                          >
                            <FontAwesomeIcon icon={faBoxOpen} />
                          </button>

                          {getShipmentInvoice(shipment).hasInvoice ? (
                            <button
                              type="button"
                              onClick={() => onViewInvoice?.(shipment)}
                              className={`text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${rowAction.invoice}`}
                              title={`View Invoice ${getShipmentInvoice(shipment).invoiceNumber || ""}`}
                            >
                              <FontAwesomeIcon icon={faReceipt} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onCreateInvoice?.(shipment)}
                              className={`text-xs border px-3 py-1.5 rounded transition-all flex items-center gap-1 ${rowAction.createInvoice}`}
                              title="Create Invoice"
                            >
                              <FontAwesomeIcon icon={faFileInvoiceDollar} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onUnassign(shipment)}
                            className={`w-8 h-8 text-xs border px-3 py-1.5 rounded transition-all flex items-center justify-center disabled:opacity-50 ${rowAction.remove}`}
                            disabled={isLocked}
                            title="Remove Shipment"
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

        {!loading && filteredData.length > 0 && (
          <TablePaginationFooter
            totalItems={filteredData.length}
            currentPage={safeCurrentPage}
            itemsPerPage={itemsPerPage}
            totalPages={totalPages}
            limitValue={manifestLimit}
            limitTitle="Manifest rows per page"
            onLimitChange={setManifestLimit}
            onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
            onNext={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            theme={theme}
          />
        )}
      </div>
    </div>

    <ReleaseToCheckerModal
      isOpen={isReleaseModalOpen}
      onClose={() => setIsReleaseModalOpen(false)}
      onSuccess={() => {
        setSelectedIds(new Set());
        onRefresh?.();
      }}
      isDark={isDark}
      tripId={tripId}
      tripStatus={tripStatus}
      tripReconciledAt={tripReconciledAt}
      defaultShipmentIds={releaseTargetShipments.map((s) => s.id)}
      defaultShipments={releaseTargetShipments}
    />
    </>
  );
}
