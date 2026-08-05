"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faBoxOpen,
  faPrint,
  faMinus,
  faFileInvoiceDollar,
  faReceipt,
} from "@fortawesome/free-solid-svg-icons";
import { getTableTheme } from "@/app/utility/constant/theme";
import { getTableActionClasses } from "@/app/utility/constant/action";
import { packageLabelUrl } from "@/app/utility/constant/templates";
import StatusBadge from "../ui/StatusBadge";
import ManifestStatusBadge from "../ui/ManifestStatusBadge";
import {
  MANIFEST_STATUS,
  resolveManifestStatus,
  isHubTransferTrip,
  isManifestEditable,
} from "@/app/utility/manifestStatus";
import TablePaginationFooter from "../ui/TablePaginationFooter";
import TripDeliveryPoolSummary from "./TripDeliveryPoolSummary";
import TripLoadSummary from "./TripLoadSummary";
import TripShipmentProgressCell from "./TripShipmentProgressCell";
import { aggregateTripLoadSummary } from "@/app/utility/tripStats";
import { formatFirestoreDate } from "@/app/utility/utilities";
import { isCompletedTrip } from "./tripHelpers";
import TripCompletedManifestsView from "./TripCompletedManifestsView";

function ActorMetaBlock({ byName, at, isDark = false, className = "" }) {
  const when = formatFirestoreDate(at);
  if (!byName && !when) return null;
  return (
    <div
      className={`mt-1 space-y-0.5 text-[10px] leading-snug ${
        isDark ? "text-slate-500" : "text-slate-500"
      } ${className}`}
    >
      {byName ? <div>by {byName}</div> : null}
      {when ? <div>{when}</div> : null}
    </div>
  );
}

function getCustomAddActor(shipment = {}) {
  const entry = Array.isArray(shipment.customAddedPackageEntries)
    ? shipment.customAddedPackageEntries.find(
        (item) => item?.addedByName || item?.addedAt,
      ) || shipment.customAddedPackageEntries[0]
    : null;
  return {
    byName: shipment.customAddedByName || entry?.addedByName || null,
    at: shipment.customAddedAt || entry?.addedAt || shipment.createdAt || null,
  };
}

function CompactManualAddLabel({ shipment, isDark = false }) {
  const { byName, at } = getCustomAddActor(shipment);
  const when = formatFirestoreDate(at);
  const details = [byName, when].filter(Boolean).join(" · ");
  const full = details ? `Manual add · ${details}` : "Manual add";

  return (
    <div
      className={`mt-0.5 text-[10px] truncate max-w-[220px] ${
        isDark ? "text-amber-500/80" : "text-amber-700"
      }`}
      title={full}
    >
      Manual add
      {details ? (
        <span className={isDark ? "text-slate-500" : "text-slate-500"}>
          {" "}
          · {details}
        </span>
      ) : null}
    </div>
  );
}

export default function TripManifestTab({
  shipments = [],
  removedManifestEntries = [],
  loading,
  isLocked,
  manifestEditable: manifestEditableProp,
  onAddShipment,
  onViewPackages,
  onUnassign,
  tripId,
  tripStatus = null,
  tripReconciledAt = null,
  tripManifestStatus = null,
  tripType = null,
  trip = null,
  onRefresh,
  isDark = false,

  // add these
  onCreateInvoice,
  onViewInvoice,
  profile,
  user = null,
}) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [manifestLimit, setManifestLimit] = useState("50");
  const theme = getTableTheme(isDark);
  const action = getTableActionClasses(isDark);

  const hubTrip = isHubTransferTrip(
    trip || {
      tripType,
      manifestStatus: tripManifestStatus,
      reconciledAt: tripReconciledAt,
    },
  );
  const manifestStatus = resolveManifestStatus(
    trip || {
      manifestStatus: tripManifestStatus,
      reconciledAt: tripReconciledAt,
      manifestLocked: isLocked,
    },
  );
  const manifestEditable =
    manifestEditableProp ??
    isManifestEditable(
      trip || {
        manifestLocked: isLocked,
        manifestStatus: tripManifestStatus,
        reconciledAt: tripReconciledAt,
      },
    );
  const manifestLocked = !manifestEditable;
  const actorRole = String(profile?.role || "").toLowerCase();
  const canRemoveShipment =
    actorRole === "admin" ||
    (actorRole === "manager" && manifestLocked === false);

  const isManifestReconciled = manifestStatus === MANIFEST_STATUS.RECONCILED;

  const loadSummary = useMemo(
    () =>
      aggregateTripLoadSummary(
        trip || {
          id: tripId,
          tripId,
          tripType,
          manifestStatus,
          reconciledAt: tripReconciledAt,
          manifestLocked: isLocked,
          status: tripStatus,
        },
        shipments,
      ),
    [
      trip,
      tripType,
      manifestStatus,
      tripReconciledAt,
      isLocked,
      tripStatus,
      shipments,
    ],
  );
  const isArrivedPhase = loadSummary.isArrivedPhase;
  const progressColumnLabel = isArrivedPhase ? "Trip Progress" : "Loaded Qty";

  const tripProgressContext = useMemo(
    () => ({
      ...(trip || {
        id: tripId,
        tripId,
        tripType,
        manifestStatus,
        reconciledAt: tripReconciledAt,
        manifestLocked: isLocked,
        status: tripStatus,
      }),
      shipments,
    }),
    [
      trip,
      tripId,
      tripType,
      manifestStatus,
      tripReconciledAt,
      isLocked,
      tripStatus,
      shipments,
    ],
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

  const removedShipments = useMemo(() => {
    const activeIds = new Set(
      shipments.map((s) => String(s.id || s.trackingShipmentId || "")),
    );
    const byShipment = new Map();

    const upsertRemoved = (docId, entry = {}) => {
      if (!docId) return;
      const packageId = entry?.packageId ? String(entry.packageId) : null;
      const packageIds = [
        ...new Set(
          [
            ...(Array.isArray(entry.packageIds) ? entry.packageIds : []),
            ...(packageId ? [packageId] : []),
          ]
            .map((id) => String(id || "").trim())
            .filter(Boolean),
        ),
      ];

      const existing = byShipment.get(docId);
      if (!existing) {
        byShipment.set(docId, {
          id: docId,
          shipmentId: entry.shipmentId || docId,
          trackingShipmentId: docId,
          recipient: { name: entry.recipientName || "—" },
          destinationCity: entry.destinationCity || "—",
          removedPackageIds: packageIds,
          removedPackages: packageIds.map((id) => ({
            packageId: id,
            removedByName: entry.removedByName || null,
            removedAt: entry.removedAt || null,
          })),
          removedAt: entry.removedAt || null,
          removedByName: entry.removedByName || null,
          reason: entry.reason || null,
          isRemoved: true,
          stillOnManifest: activeIds.has(docId),
        });
        return;
      }

      const known = new Set(existing.removedPackageIds);
      for (const id of packageIds) {
        if (known.has(id)) continue;
        known.add(id);
        existing.removedPackageIds.push(id);
        existing.removedPackages.push({
          packageId: id,
          removedByName: entry.removedByName || null,
          removedAt: entry.removedAt || null,
        });
      }
      if (
        entry.removedAt &&
        (!existing.removedAt || entry.removedAt > existing.removedAt)
      ) {
        existing.removedAt = entry.removedAt;
        existing.removedByName = entry.removedByName || existing.removedByName;
        existing.reason = entry.reason || existing.reason;
      }
    };

    for (const entry of removedManifestEntries || []) {
      const docId = String(entry?.shipmentDocId || "").trim();
      upsertRemoved(docId, entry);
    }

    // Piece removals stored on remaining trip_shipments rows.
    for (const shipment of shipments) {
      const docId = String(shipment.id || shipment.trackingShipmentId || "").trim();
      const entries = Array.isArray(shipment.removedPackageEntries)
        ? shipment.removedPackageEntries
        : [];
      const ids = Array.isArray(shipment.removedPackageIds)
        ? shipment.removedPackageIds
        : [];
      if (!docId || (entries.length === 0 && ids.length === 0)) continue;

      if (entries.length > 0) {
        for (const entry of entries) {
          upsertRemoved(docId, {
            shipmentId: shipment.shipmentId || docId,
            recipientName: shipment.recipient?.name || "—",
            destinationCity: shipment.recipient?.address?.city || "—",
            packageId: entry.packageId,
            packageIds: entry.packageId ? [entry.packageId] : [],
            removedByName: entry.removedByName || null,
            removedAt: entry.removedAt || null,
          });
        }
      } else {
        upsertRemoved(docId, {
          shipmentId: shipment.shipmentId || docId,
          recipientName: shipment.recipient?.name || "—",
          destinationCity: shipment.recipient?.address?.city || "—",
          packageIds: ids,
        });
      }
    }

    const keyword = search.toLowerCase().trim();
    return [...byShipment.values()]
      .filter((shipment) => shipment.removedPackageIds.length > 0 || !shipment.stillOnManifest)
      .filter((shipment) => {
        if (!keyword) return true;
        const haystack = [
          shipment.shipmentId,
          shipment.recipient?.name,
          ...(shipment.removedPackageIds || []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(keyword);
      });
  }, [removedManifestEntries, shipments, search]);

  const renderRemovedPieceList = (
    pieces = [],
    { sharedByName = null, sharedAt = null } = {},
  ) => {
    const seen = new Set();
    const list = Array.isArray(pieces)
      ? pieces
          .map((item) =>
            typeof item === "string"
              ? { packageId: item, removedByName: null, removedAt: null }
              : {
                  packageId: item?.packageId || null,
                  removedByName: item?.removedByName || null,
                  removedAt: item?.removedAt || null,
                },
          )
          .filter((item) => {
            const packageId = String(item.packageId || "").trim();
            if (!packageId || seen.has(packageId)) return false;
            seen.add(packageId);
            item.packageId = packageId;
            return true;
          })
      : [];
    if (!list.length) return null;

    const sharedWhen = formatFirestoreDate(sharedAt);

    return (
      <div className="mt-1.5 flex flex-col gap-2">
        {list.map((item) => {
          const pieceWhen = formatFirestoreDate(item.removedAt);
          const sameAsShared =
            (item.removedByName || null) === (sharedByName || null) &&
            pieceWhen === sharedWhen;
          const showPieceMeta =
            !sameAsShared && (item.removedByName || pieceWhen);

          return (
            <div key={item.packageId} className="min-w-0">
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded border inline-block max-w-full break-all line-through ${
                  isDark
                    ? "text-red-400/90 border-red-500/20 bg-red-500/10"
                    : "text-red-700 border-red-200 bg-red-50"
                }`}
                title={`Removed piece ${item.packageId}`}
              >
                {item.packageId}
              </span>
              {showPieceMeta ? (
                <ActorMetaBlock
                  byName={item.removedByName}
                  at={item.removedAt}
                  isDark={isDark}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
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

  if (isCompletedTrip(trip)) {
    return (
      <TripCompletedManifestsView
        trip={trip}
        shipments={shipments}
        onUnassign={onUnassign}
        user={user}
        profile={profile}
        isDark={isDark}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <>
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        {hubTrip ? (
          <TripLoadSummary trip={trip} shipments={shipments} isDark={isDark} />
        ) : (
          <TripDeliveryPoolSummary shipments={shipments} isDark={isDark} />
        )}

        {hubTrip && (
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border ${theme.statCard}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold uppercase ${theme.cellSecondary}`}
              >
                Manifest
              </span>
              <ManifestStatusBadge
                trip={
                  trip || {
                    tripType,
                    manifestStatus,
                    reconciledAt: tripReconciledAt,
                    manifestLocked: isLocked,
                  }
                }
                isDark={isDark}
              />
            </div>
            <p className={`text-xs ${theme.cellSecondary}`}>
              {isManifestReconciled
                ? "Reconciliation complete. Admin can unlock to add missing shipments, then scan load/unload and lock again."
                : manifestEditable &&
                    manifestStatus === MANIFEST_STATUS.RECEIVING_IN_PROGRESS
                  ? "Manifest reopened. Add missing shipments, finish unload scans, then lock and reconcile again."
                  : manifestStatus === MANIFEST_STATUS.RECEIVING_IN_PROGRESS
                  ? "Receiving in progress. Finish unload scans, then finalize reconciliation."
                  : manifestStatus === MANIFEST_STATUS.LOCKED
                    ? "Manifest is locked. Start receiving at Odiongan before unloading."
                    : "Manifest is open. Load packages, set trip to LOADED, then lock before dispatch."}
            </p>
          </div>
        )}

        {/* Header */}
        <div className={`p-4 rounded-2xl border ${theme.statCard}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div
                  className={`text-xs font-bold uppercase ${theme.cellSecondary}`}
                >
                  {hubTrip ? "Tracking Numbers" : "Total Shipments"}
                </div>

                <div className={`text-2xl font-bold ${theme.headingText}`}>
                  {shipments.length}{" "}
                  {/* <span className={`text-sm font-normal ${theme.cellSecondary}`}>
                  shipment{shipments.length > 1 ? "s" : ""}
                </span> */}
                </div>
              </div>
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
                  disabled={manifestLocked}
                  className={`text-xs font-bold px-3 py-1.5 h-8 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${action.solid}`}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Shipments
                </button>
              </div>
            </div>
          </div>
        </div>

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
              const loadedCount = shipment.loadedCount || 0;
              const shipmentPieceTotal =
                shipment.shipmentPieceTotal ||
                shipment.totals?.totalContentQty ||
                0;
              const isFullyLoaded = loadedCount >= (shipmentPieceTotal || 1);
              const shipmentStatus = shipment.status || "UNKNOWN";
              const isCustomAdded = shipment.customAdded === true;

              return (
                <div
                  key={shipment.id || idx}
                  className={`rounded-2xl border p-4 transition-colors border-l-2 ${theme.container} ${
                    isCustomAdded
                      ? "border-l-amber-500"
                      : "border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
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
                      {isCustomAdded ? (
                        <CompactManualAddLabel
                          shipment={shipment}
                          isDark={isDark}
                        />
                      ) : null}

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
                      {isArrivedPhase ? (
                        <TripShipmentProgressCell
                          shipment={shipment}
                          trip={tripProgressContext}
                          isDark={isDark}
                          compact
                        />
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${
                            isFullyLoaded
                              ? theme.countBadgeLoaded
                              : theme.countBadgeDefault
                          }`}
                        >
                          {loadedCount} / {shipmentPieceTotal}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={shipmentStatus} isDark={isDark} />
                      </div>
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
                      disabled={!canRemoveShipment}
                      className={`text-xs border px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40 ${rowAction.remove}`}
                      title={
                        canRemoveShipment
                          ? "Remove Shipment"
                          : "Only an Admin can remove from a locked manifest"
                      }
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
                  <th className="px-4 py-3 w-10 text-center">#</th>
                  <th className="px-4 py-3">Tracking / Customer</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3 text-center">Shipment Status</th>
                  <th className="px-4 py-3 text-center">
                    {progressColumnLabel}
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
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
                  paginatedData.map((shipment, idx) => {
                    const loadedCount = shipment.loadedCount || 0;
                    const shipmentPieceTotal =
                      shipment.shipmentPieceTotal ||
                      shipment.totals?.totalContentQty ||
                      0;
                    const isFullyLoaded =
                      loadedCount >= (shipmentPieceTotal || 1);
                    const shipmentStatus = shipment.status || "UNKNOWN";
                    const isCustomAdded = shipment.customAdded === true;

                    return (
                      <tr
                        key={shipment.id || idx}
                        className={`transition-colors ${theme.rowHover}`}
                      >
                        <td
                          className={`px-4 py-3 text-center font-mono text-xs ${theme.cellSecondary} ${
                            isCustomAdded
                              ? "shadow-[inset_2px_0_0_0_rgb(245,158,11)]"
                              : ""
                          }`}
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
                          {isCustomAdded ? (
                            <CompactManualAddLabel
                              shipment={shipment}
                              isDark={isDark}
                            />
                          ) : null}
                        </td>

                        <td
                          className={`px-4 py-3 text-xs ${theme.cellSecondary}`}
                        >
                          {shipment.recipient?.address?.city || "—"}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <StatusBadge
                            status={shipmentStatus}
                            isDark={isDark}
                          />
                        </td>

                        <td className="px-4 py-3 text-center">
                          {isArrivedPhase ? (
                            <div className="flex justify-center">
                              <TripShipmentProgressCell
                                shipment={shipment}
                                trip={tripProgressContext}
                                isDark={isDark}
                              />
                            </div>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-2 py-2 rounded border ${
                                isFullyLoaded
                                  ? theme.countBadgeLoaded
                                  : theme.countBadgeDefault
                              }`}
                            >
                              {loadedCount} / {shipmentPieceTotal}
                            </span>
                          )}
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
                              disabled={!canRemoveShipment}
                              className={`w-8 h-8 text-xs border px-3 py-1.5 rounded transition-all flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 ${rowAction.remove}`}
                              title={
                                canRemoveShipment
                                  ? "Remove Shipment"
                                  : "Only an Admin can remove from a locked manifest"
                              }
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

        {!loading && removedShipments.length > 0 && (
          <div
            className={`border rounded-2xl overflow-hidden ${theme.container}`}
          >
            <div
              className={`px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${theme.header} ${theme.cellSecondary}`}
            >
              Removed from trip ({removedShipments.length})
            </div>

            <div className="block lg:hidden divide-y divide-slate-800/50">
              {removedShipments.map((shipment) => (
                <div
                  key={`removed-mobile-${shipment.id}`}
                  className={`p-4 border-l-2 border-l-red-500/70 opacity-80 ${theme.container}`}
                >
                  <div
                    className={`font-bold text-sm font-mono ${
                      shipment.stillOnManifest ? "" : "line-through"
                    } ${theme.cellPrimary}`}
                  >
                    {shipment.shipmentId}
                  </div>
                  <div className={`text-sm mt-1 ${theme.cellSecondary}`}>
                    {shipment.recipient?.name || "—"}
                  </div>
                  <div
                    className={`text-[10px] mt-1 ${
                      isDark ? "text-red-400/90" : "text-red-700"
                    }`}
                  >
                    {shipment.stillOnManifest
                      ? "Removed pieces from trip"
                      : "Removed from trip"}
                    {shipment.removedPackageIds?.length
                      ? ` · ${shipment.removedPackageIds.length} piece(s)`
                      : ""}
                  </div>
                  <ActorMetaBlock
                    byName={shipment.removedByName}
                    at={shipment.removedAt}
                    isDark={isDark}
                  />
                  {renderRemovedPieceList(
                    shipment.removedPackages?.length
                      ? shipment.removedPackages
                      : shipment.removedPackageIds,
                    {
                      sharedByName: shipment.removedByName,
                      sharedAt: shipment.removedAt,
                    },
                  )}
                  <button
                    type="button"
                    onClick={() => onViewPackages?.(shipment)}
                    className={`mt-3 text-xs border px-3 py-2 rounded-xl ${rowAction.view}`}
                  >
                    <FontAwesomeIcon icon={faBoxOpen} className="mr-2" />
                    View pieces
                  </button>
                </div>
              ))}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className={`w-full text-left text-sm ${theme.tableText}`}>
                <thead
                  className={`uppercase font-bold text-[10px] tracking-wider ${theme.thead}`}
                >
                  <tr>
                    <th className="px-4 py-3">Tracking / Customer</th>
                    <th className="px-4 py-3">Removed pieces</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.tbodyDivide}`}>
                  {removedShipments.map((shipment) => (
                    <tr
                      key={`removed-${shipment.id}`}
                      className="opacity-80"
                    >
                      <td
                        className={`px-4 py-3 shadow-[inset_2px_0_0_0_rgb(239,68,68)]`}
                      >
                        <div
                          className={`font-bold text-xs font-mono ${
                            shipment.stillOnManifest ? "" : "line-through"
                          } ${theme.cellPrimary}`}
                        >
                          {shipment.shipmentId}
                        </div>
                        <div
                          className={`text-[11px] truncate max-w-[180px] ${theme.cellSecondary}`}
                        >
                          {shipment.recipient?.name || "—"}
                        </div>
                        <ActorMetaBlock
                          byName={shipment.removedByName}
                          at={shipment.removedAt}
                          isDark={isDark}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {shipment.removedPackageIds?.length ? (
                          renderRemovedPieceList(
                            shipment.removedPackages?.length
                              ? shipment.removedPackages
                              : shipment.removedPackageIds,
                            {
                              sharedByName: shipment.removedByName,
                              sharedAt: shipment.removedAt,
                            },
                          )
                        ) : (
                          <span className={`text-[10px] ${theme.cellSecondary}`}>
                            Entire shipment
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-xs ${theme.cellSecondary}`}>
                        {shipment.destinationCity || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center text-[9px] tracking-wider font-bold px-1.5 py-0.5 rounded border leading-none ${
                            isDark
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          REMOVED
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onViewPackages?.(shipment)}
                          className={`text-xs border px-3 py-1.5 rounded transition-all ${rowAction.view}`}
                          title="View pieces"
                        >
                          <FontAwesomeIcon icon={faBoxOpen} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
