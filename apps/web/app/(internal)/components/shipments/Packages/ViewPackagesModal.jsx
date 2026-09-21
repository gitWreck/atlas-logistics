"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTimes,
  faSpinner,
  faCube,
  faPlus,
  faCheckSquare,
  faSquare,
  faPen,
  faTrash,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";
import AddPackageForm from "./AddPackageForm";
import {
  getModalThemeClasses,
  getTableTheme,
} from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { formatFirestoreDate } from "@/app/utility/utilities";
import StatusBadge from "../../ui/StatusBadge";
import TablePaginationFooter from "../../ui/TablePaginationFooter";
import PackageBreakdownPanel from "./PackageBreakdownPanel";
import ShipmentOperations from "../ShipmentOperations";
import PieceStatusOverrideModal from "./PieceStatusOverrideModal";
import RemovePackageFromTripModal from "./RemovePackageFromTripModal";
import { useAuth } from "@/app/context/AuthContext";
import {
  canOverrideShipmentStatus,
  canOverridePieceStatus,
} from "@/app/utility/roleAccess";
import {
  BASIC_PACKAGING_TYPES,
  INITIAL_PACKAGE_STATE,
  contactLabel,
  displayValue,
  getShipmentDisplayId,
  getShipmentRouteLabel,
  getShipmentTripIdsLabel,
  isPackageLocked,
} from "../shipmentHelpers";

const ITEMS_PER_PAGE = 6;

function ShipmentDetailRow({ label, value, isDark }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 text-xs">
      <div className="font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`min-w-0 break-words font-medium ${
          isDark ? "text-slate-200" : "text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function ViewPackagesModal({
  isOpen,
  onClose,
  shipment,
  tripId = null,
  removedManifestEntries = [],
  isLocked,
  onRefresh,
  isDark = false,
  profile = null,
  allowShipmentStatusOverride = true,
}) {
  const { profile: authProfile } = useAuth();
  const effectiveProfile = profile || authProfile;
  const showShipmentStatusOverride =
    allowShipmentStatusOverride && canOverrideShipmentStatus(effectiveProfile);
  const showPieceStatusOverride = canOverridePieceStatus(effectiveProfile);
  const actorRole = String(effectiveProfile?.role || "").toLowerCase();
  const canRemovePieceFromTrip =
    actorRole === "admin" || (actorRole === "manager" && isLocked !== true);

  const [packages, setPackages] = useState([]);
  const [fullShipment, setFullShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [newPackage, setNewPackage] = useState(INITIAL_PACKAGE_STATE);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pieceForStatusOverride, setPieceForStatusOverride] = useState(null);
  const [packageToRemove, setPackageToRemove] = useState(null);
  const [scopeToTrip, setScopeToTrip] = useState(true);

  const modalTheme = getModalThemeClasses(isDark);
  const modalAction = getModalActionClasses();
  const tableTheme = getTableTheme(isDark);

  const customAddedPackageIdSet = useMemo(() => {
    const ids = Array.isArray(shipment?.customAddedPackageIds)
      ? shipment.customAddedPackageIds
      : [];
    return new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  }, [shipment?.customAddedPackageIds]);

  const customAddedByNameByPackageId = useMemo(() => {
    const map = new Map();
    const fallbackName = shipment?.customAddedByName || null;
    const fallbackAt = shipment?.customAddedAt || null;
    for (const entry of shipment?.customAddedPackageEntries || []) {
      const packageId = String(entry?.packageId || "").trim();
      if (!packageId) continue;
      map.set(packageId, {
        name: entry.addedByName || fallbackName,
        at: entry.addedAt || fallbackAt,
      });
    }
    for (const id of customAddedPackageIdSet) {
      if (!map.has(id)) {
        map.set(id, { name: fallbackName, at: fallbackAt });
      }
    }
    return map;
  }, [
    shipment?.customAddedByName,
    shipment?.customAddedAt,
    shipment?.customAddedPackageEntries,
    customAddedPackageIdSet,
  ]);

  const removedPackageIdSet = useMemo(() => {
    const fromShipment = Array.isArray(shipment?.removedPackageIds)
      ? shipment.removedPackageIds
      : [];
    const shipmentKey = String(
      shipment?.id || shipment?.trackingShipmentId || "",
    ).trim();
    const fromTripEntries = (removedManifestEntries || [])
      .filter(
        (entry) => String(entry?.shipmentDocId || "").trim() === shipmentKey,
      )
      .flatMap((entry) => {
        if (Array.isArray(entry?.packageIds) && entry.packageIds.length) {
          return entry.packageIds;
        }
        return entry?.packageId ? [entry.packageId] : [];
      });
    return new Set(
      [...fromShipment, ...fromTripEntries]
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    );
  }, [
    shipment?.id,
    shipment?.trackingShipmentId,
    shipment?.removedPackageIds,
    removedManifestEntries,
  ]);

  const removedByNameByPackageId = useMemo(() => {
    const map = new Map();
    const shipmentKey = String(
      shipment?.id || shipment?.trackingShipmentId || "",
    ).trim();

    for (const entry of shipment?.removedPackageEntries || []) {
      const packageId = String(entry?.packageId || "").trim();
      if (!packageId) continue;
      map.set(packageId, {
        name: entry.removedByName || null,
        at: entry.removedAt || null,
      });
    }

    for (const entry of removedManifestEntries || []) {
      if (String(entry?.shipmentDocId || "").trim() !== shipmentKey) continue;
      const ids =
        Array.isArray(entry?.packageIds) && entry.packageIds.length
          ? entry.packageIds
          : entry?.packageId
            ? [entry.packageId]
            : [];
      for (const id of ids) {
        const packageId = String(id || "").trim();
        if (!packageId) continue;
        const prev = map.get(packageId) || {};
        map.set(packageId, {
          name: entry.removedByName || prev.name || null,
          at: entry.removedAt || prev.at || null,
        });
      }
    }

    return map;
  }, [
    shipment?.id,
    shipment?.trackingShipmentId,
    shipment?.removedPackageEntries,
    removedManifestEntries,
  ]);

  const isCustomAddedPackage = (pkg) => {
    const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
    return packageId ? customAddedPackageIdSet.has(packageId) : false;
  };

  const isRemovedPackage = (pkg) => {
    const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
    return packageId ? removedPackageIdSet.has(packageId) : false;
  };

  const formatPackageActorMeta = (name, at) => {
    const when = formatFirestoreDate(at);
    return { byName: name || "", when };
  };

  const renderPackageActorMeta = (name, at) => {
    const { byName, when } = formatPackageActorMeta(name, at);
    if (!byName && !when) return null;
    return (
      <div
        className={`mt-1 space-y-0.5 text-[10px] leading-snug ${
          isDark ? "text-slate-500" : "text-slate-500"
        }`}
      >
        {byName ? <div>by {byName}</div> : null}
        {when ? <div>{when}</div> : null}
      </div>
    );
  };

  const getAddedActorMetaNode = (pkg) => {
    const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
    if (!packageId || !customAddedPackageIdSet.has(packageId)) return null;
    const meta = customAddedByNameByPackageId.get(packageId) || {};
    return renderPackageActorMeta(meta.name, meta.at);
  };

  const getRemovedActorMetaNode = (pkg) => {
    const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
    if (!packageId || !removedPackageIdSet.has(packageId)) return null;
    const meta = removedByNameByPackageId.get(packageId) || {};
    return renderPackageActorMeta(meta.name, meta.at);
  };

  useEffect(() => {
    if (isOpen && shipment?.id) {
      setFullShipment(null);
      fetchFullShipmentDetails(shipment.id);
    } else {
      setPackages([]);
      setFullShipment(null);
      setEditingId(null);
      setIsAdding(false);
      setCurrentPage(1);
      setSearch("");
      setStatusFilter("ALL");
      setPieceForStatusOverride(null);
      setPackageToRemove(null);
      setScopeToTrip(true);
    }
  }, [isOpen, shipment?.id]);

  const handleRefreshAll = async () => {
    if (shipment?.id) {
      await fetchFullShipmentDetails(shipment.id);
    }
    onRefresh?.();
  };

  const fetchFullShipmentDetails = async (id) => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/shipments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load");

      const json = await res.json();
      setFullShipment(json.shipment || null);
      setPackages(json.shipment?.packages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const packageBelongsToTrip = (pkg) => {
    const trip = String(tripId || "").trim();
    if (!trip) return true;
    const loadedOn = String(pkg.loadedOnTrip || "").trim();
    const currentTrip = String(pkg.currentTripId || "").trim();
    const hubOn = String(pkg.hubReceivedOnTrip || "").trim();
    const tripIds = Array.isArray(pkg.currentTripIds)
      ? pkg.currentTripIds.map(String)
      : [];
    return (
      loadedOn === trip ||
      currentTrip === trip ||
      hubOn === trip ||
      tripIds.includes(trip)
    );
  };

  const tripScopedPackages = useMemo(() => {
    if (!tripId || !scopeToTrip) return packages;
    const scoped = packages.filter(
      (pkg) => packageBelongsToTrip(pkg) || isRemovedPackage(pkg),
    );
    // Fall back to all pieces if none are trip-linked yet (e.g. just assigned,
    // not yet scanned) so the list is never confusingly empty.
    return scoped.length > 0 ? scoped : packages;
  }, [packages, tripId, scopeToTrip, removedPackageIdSet]);

  const tripScopeActive =
    Boolean(tripId) &&
    scopeToTrip &&
    tripScopedPackages.length < packages.length;

  const filteredPackages = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return tripScopedPackages.filter((pkg) => {
      const matchesSearch =
        !keyword ||
        (pkg.description || "").toLowerCase().includes(keyword) ||
        (pkg.packageId || "").toLowerCase().includes(keyword) ||
        (pkg.packagingType || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" ? true : pkg.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tripScopedPackages, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPackages.length / ITEMS_PER_PAGE),
  );

  const currentSafePage = Math.min(currentPage, totalPages);
  const startIndex = (currentSafePage - 1) * ITEMS_PER_PAGE;

  const paginatedPackages = useMemo(() => {
    return filteredPackages.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPackages, startIndex]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, scopeToTrip]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const getActualIndex = (pkg) =>
    packages.findIndex((p) => p.packageId === pkg.packageId);

  const saveUpdates = async (updatedPackages) => {
    try {
      setIsSaving(true);

      await updateShipmentPackages({
        shipmentId: shipment.id,
        packages: updatedPackages,
      });

      setPackages(updatedPackages);
      setFullShipment((prev) =>
        prev ? { ...prev, packages: updatedPackages } : prev,
      );
      setEditingId(null);
      setIsAdding(false);
      setNewPackage(INITIAL_PACKAGE_STATE);

      onRefresh?.();
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = (idx) => {
    const pkg = packages[idx];
    if (!pkg) return;

    if (tripId) {
      const packageId = String(
        pkg.packageId || pkg.trackingNumber || "",
      ).trim();
      if (!packageId) {
        alert("This package has no tracking ID and cannot be removed safely.");
        return;
      }
      setPackageToRemove(pkg);
      return;
    }

    if (!confirm("Permanently remove this package from the shipment?")) return;
    saveUpdates(packages.filter((_, i) => i !== idx));
  };

  const handleRemoveFromTripSuccess = async (result = {}) => {
    setPackageToRemove(null);
    if (result.manifestRemoved) {
      onRefresh?.();
      onClose?.();
      return;
    }
    await handleRefreshAll();
  };

  const handleEditStart = (pkg, idx) => {
    setEditingId(idx);
    setEditForm({ ...pkg });
  };

  const handleEditSave = () => {
    const updated = [...packages];
    updated[editingId] = editForm;
    saveUpdates(updated);
  };

  const handleAddSave = () => {
    if (!newPackage.description) {
      alert("Description required");
      return;
    }

    const isBulk = ["Sack", "Bundle", "Roll"].includes(
      newPackage.packagingType,
    );

    const nextSequence = packages.length + 1;

    const packageToAdd = {
      ...newPackage,
      declaredValue: Number(newPackage.declaredValue) || 0,
      quantity: isBulk ? Number(newPackage.quantity) || 1 : 1,
      weight: Number(newPackage.weight) || 0,
      status: "RECEIVED",
      sequence: nextSequence,
      packageId: `${shipment.shipmentId}-${String(nextSequence).padStart(2, "0")}`,
      currentLocation: "",
      loadedAt: null,
      loadedOnTrip: null,
    };

    saveUpdates([...packages, packageToAdd]);
  };

  if (!isOpen || !shipment) return null;

  const shipmentDetails =
    fullShipment?.id === shipment.id ? fullShipment : shipment;
  const totalQuantity = packages.reduce(
    (total, pkg) => total + (Number(pkg.quantity) || 0),
    0,
  );
  const updatedAt = formatFirestoreDate(
    shipmentDetails.updatedAt || shipmentDetails.createdAt,
  );
  const trackingNumber = displayValue(getShipmentDisplayId(shipmentDetails));

  return (
    <>
      <div className="fixed inset-0 z-[60]">
        <div
          className={`absolute inset-0 ${modalTheme.overlay}`}
          onClick={onClose}
        />

        <div className="relative z-10 flex h-full w-full items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-7xl rounded-none sm:rounded-2xl shadow-2xl flex flex-col border animate-in zoom-in-95 duration-200 ${modalTheme.modal}`}
          >
            {/* HEADER */}
            <div
              className={`shrink-0 flex items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border-b ${modalTheme.header}`}
            >
              <div className="min-w-0">
                <div
                  className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 ${modalTheme.accentText}`}
                >
                  Shipment Contents
                </div>

                <h2
                  className={`text-base sm:text-xl font-bold flex items-center gap-2 sm:gap-3 min-w-0 ${modalTheme.title}`}
                >
                  <FontAwesomeIcon
                    icon={faBoxOpen}
                    className={`shrink-0 ${modalTheme.label}`}
                  />
                  <span className="truncate">{trackingNumber}</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl ${modalTheme.closeButton}`}
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>

            {/* BODY */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
                {/* LEFT SIDE */}
                <div className="xl:col-span-4 space-y-4">
                  <div
                    className={`border rounded-2xl p-4 ${modalTheme.statsCard}`}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faCube}
                          className={modalTheme.label}
                        />
                        <div>
                          <div
                            className={`text-[10px] font-bold uppercase ${modalTheme.label}`}
                          >
                            Items
                          </div>
                          <div
                            className={`text-base font-bold ${modalTheme.title}`}
                          >
                            {packages.length}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div
                          className={`text-[10px] font-bold uppercase ${modalTheme.label}`}
                        >
                          Quantity
                        </div>
                        <div
                          className={`text-base font-bold ${modalTheme.title}`}
                        >
                          {totalQuantity}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`border rounded-2xl p-4 ${modalTheme.panelSurface}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div
                          className={`text-[10px] font-bold uppercase ${modalTheme.label}`}
                        >
                          Shipment Details
                        </div>
                        <div
                          className={`text-sm font-bold ${modalTheme.title}`}
                        >
                          {trackingNumber}
                        </div>
                      </div>

                      <StatusBadge
                        status={shipmentDetails.status || "UNASSIGNED"}
                        isDark={isDark}
                      />
                    </div>

                    <div className="space-y-3">
                      <ShipmentDetailRow
                        label="Trip ID"
                        value={displayValue(
                          getShipmentTripIdsLabel(shipmentDetails),
                        )}
                        isDark={isDark}
                      />
                      <ShipmentDetailRow
                        label="Route"
                        value={getShipmentRouteLabel(shipmentDetails)}
                        isDark={isDark}
                      />
                      <ShipmentDetailRow
                        label="Sender"
                        value={contactLabel(shipmentDetails.sender)}
                        isDark={isDark}
                      />
                      <ShipmentDetailRow
                        label="Recipient"
                        value={contactLabel(shipmentDetails.recipient)}
                        isDark={isDark}
                      />
                      <ShipmentDetailRow
                        label="Location"
                        value={displayValue(shipmentDetails.currentLocation)}
                        isDark={isDark}
                      />
                      <ShipmentDetailRow
                        label="Updated"
                        value={updatedAt || "-"}
                        isDark={isDark}
                      />
                    </div>
                  </div>

                  <PackageBreakdownPanel
                    shipment={shipmentDetails}
                    isDark={isDark}
                  />

                  {showShipmentStatusOverride && (
                    <ShipmentOperations
                      shipmentId={shipment.id}
                      currentStatus={shipmentDetails.status}
                      isDark={isDark}
                      custodyLocked={isLocked}
                      profile={effectiveProfile}
                      onRefresh={handleRefreshAll}
                    />
                  )}

                  <div
                    className={`border rounded-2xl p-4 ${modalTheme.panelSurface}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div
                          className={`text-[10px] font-bold uppercase ${modalTheme.label}`}
                        >
                          Package Form
                        </div>
                        <div
                          className={`text-sm font-bold ${modalTheme.title}`}
                        >
                          Add New Item
                        </div>
                      </div>
                    </div>

                    {isAdding ? (
                      <AddPackageForm
                        newPackage={newPackage}
                        setNewPackage={setNewPackage}
                        setIsAdding={setIsAdding}
                        handleAddSave={handleAddSave}
                        isSaving={isSaving}
                        isDark={isDark}
                        packagingTypes={BASIC_PACKAGING_TYPES}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className={`w-full py-6 border-2 border-dashed rounded-2xl text-xs font-bold uppercase flex flex-col items-center gap-2 ${modalTheme.label} ${modalTheme.panelSurface}`}
                      >
                        <FontAwesomeIcon icon={faPlus} />
                        Add Item
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="xl:col-span-8 space-y-4">
                  <div
                    className={`border rounded-2xl overflow-hidden ${tableTheme.container}`}
                  >
                    <div className={`p-4 border-b ${tableTheme.header}`}>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div
                              className={`text-xs font-bold uppercase ${tableTheme.cellSecondary}`}
                            >
                              Package Items
                            </div>

                            <div
                              className={`text-lg font-bold ${tableTheme.headingText}`}
                            >
                              {filteredPackages.length}{" "}
                              <span
                                className={`text-sm font-normal ${tableTheme.cellSecondary}`}
                              >
                                result{filteredPackages.length > 1 ? "s" : ""}
                              </span>
                            </div>

                            {tripId ? (
                              <button
                                type="button"
                                onClick={() => setScopeToTrip((prev) => !prev)}
                                className={`mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide leading-none transition-colors ${
                                  scopeToTrip
                                    ? "border-blue-500/40 bg-blue-500/10 text-blue-500"
                                    : `${tableTheme.roleBadge}`
                                }`}
                                title={
                                  scopeToTrip
                                    ? "Showing only pieces on this trip. Click to show all pieces."
                                    : "Showing all pieces. Click to show only this trip's pieces."
                                }
                              >
                                <FontAwesomeIcon
                                  icon={scopeToTrip ? faCheckSquare : faSquare}
                                  className="text-[10px]"
                                />
                                {scopeToTrip ? "This trip only" : "All pieces"}
                                {scopeToTrip && packages.length > 0
                                  ? ` (${tripScopedPackages.length}/${packages.length})`
                                  : ""}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                          <div className="relative col-span-1 sm:col-span-2">
                            <FontAwesomeIcon
                              icon={faSearch}
                              className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${tableTheme.inputIcon}`}
                            />
                            <input
                              type="text"
                              placeholder="Search packages..."
                              className={`w-full border rounded-xl pl-8 pr-3 py-2 text-xs outline-none ${tableTheme.input}`}
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>

                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            // className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${tableTheme.input}`}
                            // className={`w-full border rounded-lg px-3 py-1.5 text-xs h-8 ${tableTheme.input}`}
                            className={`w-full border rounded-lg px-3 py-1.5 text-xs h-8 leading-none ${tableTheme.input}`}
                          >
                            <option value="ALL">All Status</option>
                            <option value="RECEIVED">Received</option>
                            <option value="LOADED">Loaded</option>
                            <option value="IN_TRANSIT">In Transit</option>
                            <option value="DELIVERED">Delivered</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* MOBILE CARDS */}
                    <div className="block lg:hidden p-3 space-y-3">
                      {loading ? (
                        <div
                          className={`rounded-2xl border px-4 py-10 text-center ${tableTheme.emptyText}`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                            <span>Loading packages...</span>
                          </div>
                        </div>
                      ) : paginatedPackages.length === 0 ? (
                        <div
                          className={`rounded-2xl border px-4 py-10 text-center italic ${tableTheme.emptyText}`}
                        >
                          No packages found.
                        </div>
                      ) : (
                        paginatedPackages.map((pkg) => {
                          const actualIdx = getActualIndex(pkg);
                          const locked =
                            isLocked || isPackageLocked(pkg.status);
                          const removeDisabled =
                            isSaving ||
                            (tripId ? !canRemovePieceFromTrip : locked);
                          const isEditing = editingId === actualIdx;

                          return (
                            <div
                              key={pkg.packageId || actualIdx}
                              className={`rounded-2xl border p-4 transition-all ${tableTheme.container}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div
                                        className={`font-bold text-sm break-words ${tableTheme.cellPrimary}`}
                                      >
                                        {pkg.description || "Item"}
                                      </div>

                                      <div className="mt-1">
                                        <span className="font-mono text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 break-all inline-block">
                                          {pkg.packageId}
                                        </span>
                                      </div>
                                    </div>

                                    <span
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded border text-xs font-mono font-bold shrink-0 ${
                                        isDark
                                          ? "bg-slate-900 border-slate-800 text-slate-500"
                                          : "bg-slate-100 border-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {pkg.sequence || actualIdx + 1}
                                    </span>
                                  </div>

                                  <div
                                    className={`flex flex-wrap gap-2 mt-3 text-[10px] ${tableTheme.cellSecondary}`}
                                  >
                                    <span
                                      className={`px-2 py-0.5 rounded border ${tableTheme.roleBadge}`}
                                    >
                                      {pkg.packagingType || "Box"}
                                    </span>

                                    {pkg.isFragile && (
                                      <span className="text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                        Fragile
                                      </span>
                                    )}

                                    {pkg.isPerishable && (
                                      <span className="text-cyan-500 font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                        Perishable
                                      </span>
                                    )}

                                    {isCustomAddedPackage(pkg) &&
                                      !isRemovedPackage(pkg) && (
                                      <span
                                        className={`font-bold px-1.5 py-0.5 rounded border ${
                                          isDark
                                            ? "text-amber-500/90 border-amber-500/20 bg-amber-500/10"
                                            : "text-amber-700 border-amber-300 bg-amber-50"
                                        }`}
                                      >
                                        Manual add
                                      </span>
                                    )}

                                    {isRemovedPackage(pkg) && (
                                      <span
                                        className={`font-bold px-1.5 py-0.5 rounded border ${
                                          isDark
                                            ? "text-red-400 border-red-500/20 bg-red-500/10"
                                            : "text-red-700 border-red-200 bg-red-50"
                                        }`}
                                      >
                                        Removed
                                      </span>
                                    )}

                                    <span className="text-blue-500 font-bold">
                                      {pkg.quantity || 1} pcs
                                    </span>
                                  </div>
                                  {(() => {
                                    if (isRemovedPackage(pkg)) {
                                      return getRemovedActorMetaNode(pkg);
                                    }
                                    if (isCustomAddedPackage(pkg)) {
                                      return getAddedActorMetaNode(pkg);
                                    }
                                    return null;
                                  })()}

                                  <div className="mt-3 flex items-center gap-2">
                                    <StatusBadge
                                      status={pkg.status}
                                      isDark={isDark}
                                    />
                                    <StatusBadge
                                      status={
                                        pkg.billingStatus || "NOT_INVOICED"
                                      }
                                      label={
                                        pkg.billingStatus === "INVOICED"
                                          ? "Invoiced"
                                          : "Not Invoiced"
                                      }
                                      isDark={isDark}
                                      compact
                                    />
                                    {showPieceStatusOverride && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPieceForStatusOverride(pkg)
                                        }
                                        className={`h-7 w-7 rounded inline-flex items-center justify-center ${
                                          isDark
                                            ? "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
                                            : "bg-slate-200 hover:bg-slate-300 text-slate-600 border border-slate-300"
                                        }`}
                                        title="Change piece status"
                                      >
                                        <FontAwesomeIcon
                                          icon={faPen}
                                          className="text-[10px]"
                                        />
                                      </button>
                                    )}
                                  </div>

                                  {isEditing ? (
                                    <div className="mt-4 space-y-2">
                                      <input
                                        type="text"
                                        value={editForm.description || ""}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({
                                            ...prev,
                                            description: e.target.value,
                                          }))
                                        }
                                        className={`w-full border rounded-xl px-3 py-2 text-sm ${modalTheme.input}`}
                                      />

                                      <div className="grid grid-cols-2 gap-2">
                                        <select
                                          value={
                                            editForm.packagingType || "Box"
                                          }
                                          onChange={(e) =>
                                            setEditForm((prev) => ({
                                              ...prev,
                                              packagingType: e.target.value,
                                            }))
                                          }
                                          className={`w-full border rounded-xl px-3 py-2 text-sm ${modalTheme.input}`}
                                        >
                                          {BASIC_PACKAGING_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                              {type}
                                            </option>
                                          ))}
                                        </select>

                                        <input
                                          type="number"
                                          value={editForm.quantity || ""}
                                          onChange={(e) =>
                                            setEditForm((prev) => ({
                                              ...prev,
                                              quantity: e.target.value,
                                            }))
                                          }
                                          placeholder="Qty"
                                          className={`w-full border rounded-xl px-3 py-2 text-sm ${modalTheme.input}`}
                                        />
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 pt-2">
                                        <button
                                          type="button"
                                          onClick={handleEditSave}
                                          disabled={isSaving}
                                          className={`${modalAction.primaryInline} justify-center`}
                                        >
                                          Save
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setEditingId(null)}
                                          className={`${modalTheme.secondaryButton} justify-center`}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleEditStart(pkg, actualIdx)
                                        }
                                        disabled={locked}
                                        className={`h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold ${
                                          isDark
                                            ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                                            : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                                        } disabled:opacity-30`}
                                      >
                                        <FontAwesomeIcon
                                          icon={faPen}
                                          className="text-xs"
                                        />
                                        Edit
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleRemove(actualIdx)}
                                        disabled={removeDisabled}
                                        title={
                                          tripId && !canRemovePieceFromTrip
                                            ? "Only an Admin can remove a piece from a locked trip"
                                            : "Remove piece"
                                        }
                                        className={`h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold ${
                                          isDark
                                            ? "bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                                            : "bg-slate-200 hover:bg-red-50 text-slate-600 hover:text-red-600"
                                        } disabled:opacity-30`}
                                      >
                                        <FontAwesomeIcon
                                          icon={faTrash}
                                          className="text-xs"
                                        />
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table
                        className={`w-full text-left text-sm ${tableTheme.tableText}`}
                      >
                        <thead
                          className={`uppercase font-semibold text-xs ${tableTheme.thead}`}
                        >
                          <tr>
                            <th className="px-4 py-3 w-12 text-center">#</th>
                            <th className="px-4 py-3">Item Details</th>
                            <th className="px-4 py-3">Tracking</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody className={`divide-y ${tableTheme.tbodyDivide}`}>
                          {loading ? (
                            <tr>
                              <td
                                colSpan="5"
                                className={`px-4 py-10 text-center ${tableTheme.emptyText}`}
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <FontAwesomeIcon
                                    icon={faSpinner}
                                    spin
                                    size="2x"
                                  />
                                  <span>Loading packages...</span>
                                </div>
                              </td>
                            </tr>
                          ) : paginatedPackages.length === 0 ? (
                            <tr>
                              <td
                                colSpan="5"
                                className={`px-4 py-10 text-center italic ${tableTheme.emptyText}`}
                              >
                                No packages found.
                              </td>
                            </tr>
                          ) : (
                            paginatedPackages.map((pkg) => {
                              const actualIdx = getActualIndex(pkg);
                              const locked =
                                isLocked || isPackageLocked(pkg.status);
                              const removeDisabled =
                                isSaving ||
                                (tripId ? !canRemovePieceFromTrip : locked);
                              const isEditing = editingId === actualIdx;

                              return (
                                <tr
                                  key={pkg.packageId || actualIdx}
                                  className={`transition-all ${tableTheme.rowHover}`}
                                >
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-mono font-bold ${
                                        isDark
                                          ? "bg-slate-900 border-slate-800 text-slate-500"
                                          : "bg-slate-100 border-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {pkg.sequence || actualIdx + 1}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <input
                                          type="text"
                                          value={editForm.description || ""}
                                          onChange={(e) =>
                                            setEditForm((prev) => ({
                                              ...prev,
                                              description: e.target.value,
                                            }))
                                          }
                                          className={`w-full border rounded-lg px-3 py-2 text-sm ${modalTheme.input}`}
                                        />

                                        <div className="grid grid-cols-2 gap-2">
                                          <select
                                            value={
                                              editForm.packagingType || "Box"
                                            }
                                            onChange={(e) =>
                                              setEditForm((prev) => ({
                                                ...prev,
                                                packagingType: e.target.value,
                                              }))
                                            }
                                            className={`w-full border rounded-lg px-3 py-2 text-sm ${modalTheme.input}`}
                                          >
                                            {BASIC_PACKAGING_TYPES.map(
                                              (type) => (
                                                <option key={type} value={type}>
                                                  {type}
                                                </option>
                                              ),
                                            )}
                                          </select>

                                          <input
                                            type="number"
                                            value={editForm.quantity || ""}
                                            onChange={(e) =>
                                              setEditForm((prev) => ({
                                                ...prev,
                                                quantity: e.target.value,
                                              }))
                                            }
                                            placeholder="Qty"
                                            className={`w-full border rounded-lg px-3 py-2 text-sm ${modalTheme.input}`}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div
                                          className={`font-bold text-sm ${tableTheme.cellPrimary}`}
                                        >
                                          {pkg.description || "Item"}
                                        </div>

                                        <div
                                          className={`flex flex-wrap gap-2 mt-1 text-[10px] ${tableTheme.cellSecondary}`}
                                        >
                                          <span
                                            className={`px-2 py-0.5 rounded border ${tableTheme.roleBadge}`}
                                          >
                                            {pkg.packagingType || "Box"}
                                          </span>

                                          {pkg.isFragile && (
                                            <span className="text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                              Fragile
                                            </span>
                                          )}

                                          {pkg.isPerishable && (
                                            <span className="text-cyan-500 font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                              Perishable
                                            </span>
                                          )}

                                          {isCustomAddedPackage(pkg) &&
                                            !isRemovedPackage(pkg) && (
                                            <span
                                              className={`font-bold px-1.5 py-0.5 rounded border ${
                                                isDark
                                                  ? "text-amber-500/90 border-amber-500/20 bg-amber-500/10"
                                                  : "text-amber-700 border-amber-300 bg-amber-50"
                                              }`}
                                            >
                                              Manual add
                                            </span>
                                          )}

                                          {isRemovedPackage(pkg) && (
                                            <span
                                              className={`font-bold px-1.5 py-0.5 rounded border ${
                                                isDark
                                                  ? "text-red-400 border-red-500/20 bg-red-500/10"
                                                  : "text-red-700 border-red-200 bg-red-50"
                                              }`}
                                            >
                                              Removed
                                            </span>
                                          )}

                                          <span className="text-blue-500 font-bold">
                                            {pkg.quantity || 1} pcs
                                          </span>
                                        </div>
                                        {(() => {
                                          if (isRemovedPackage(pkg)) {
                                            return getRemovedActorMetaNode(pkg);
                                          }
                                          if (isCustomAddedPackage(pkg)) {
                                            return getAddedActorMetaNode(pkg);
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-4 py-3">
                                    <span className="font-mono text-[11px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                      {pkg.packageId}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <StatusBadge
                                        status={pkg.status}
                                        isDark={isDark}
                                      />
                                      <StatusBadge
                                        status={
                                          pkg.billingStatus || "NOT_INVOICED"
                                        }
                                        label={
                                          pkg.billingStatus === "INVOICED"
                                            ? "Invoiced"
                                            : "Not Invoiced"
                                        }
                                        isDark={isDark}
                                        compact
                                      />
                                      {showPieceStatusOverride && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPieceForStatusOverride(pkg)
                                          }
                                          className={`h-7 w-7 rounded flex items-center justify-center ${
                                            isDark
                                              ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                                              : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                                          }`}
                                          title="Change piece status"
                                        >
                                          <FontAwesomeIcon
                                            icon={faPen}
                                            className="text-[10px]"
                                          />
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                      {isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={handleEditSave}
                                            disabled={isSaving}
                                            className={`${modalAction.primaryInline} flex-none px-4`}
                                          >
                                            Save
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className={`${modalTheme.secondaryButton} flex-none px-4`}
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleEditStart(pkg, actualIdx)
                                            }
                                            disabled={locked}
                                            className={`h-8 w-8 rounded flex items-center justify-center ${
                                              isDark
                                                ? "bg-slate-800 hover:bg-slate-700 text-slate-400"
                                                : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                                            } disabled:opacity-30`}
                                          >
                                            <FontAwesomeIcon
                                              icon={faPen}
                                              className="text-xs"
                                            />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemove(actualIdx)
                                            }
                                            disabled={removeDisabled}
                                            title={
                                              tripId && !canRemovePieceFromTrip
                                                ? "Only an Admin can remove a piece from a locked trip"
                                                : "Remove piece"
                                            }
                                            className={`h-8 w-8 rounded flex items-center justify-center ${
                                              isDark
                                                ? "bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                                                : "bg-slate-200 hover:bg-red-50 text-slate-600 hover:text-red-600"
                                            } disabled:opacity-30`}
                                          >
                                            <FontAwesomeIcon
                                              icon={faTrash}
                                              className="text-xs"
                                            />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* PAGINATION */}
                    {!loading && filteredPackages.length > 0 && (
                      <TablePaginationFooter
                        totalItems={filteredPackages.length}
                        currentPage={currentSafePage}
                        itemsPerPage={ITEMS_PER_PAGE}
                        totalPages={totalPages}
                        onPrevious={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        onNext={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages),
                          )
                        }
                        theme={tableTheme}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={`shrink-0 p-4 border-t ${modalTheme.header}`} />
          </div>
        </div>
      </div>

      {pieceForStatusOverride && (
        <PieceStatusOverrideModal
          pkg={pieceForStatusOverride}
          shipmentId={shipment.id}
          onClose={() => setPieceForStatusOverride(null)}
          isDark={isDark}
          onRefresh={handleRefreshAll}
        />
      )}

      <RemovePackageFromTripModal
        isOpen={!!packageToRemove}
        pkg={packageToRemove}
        shipment={shipment}
        tripId={tripId}
        onClose={() => setPackageToRemove(null)}
        onSuccess={handleRemoveFromTripSuccess}
        isDark={isDark}
      />
    </>
  );
}
