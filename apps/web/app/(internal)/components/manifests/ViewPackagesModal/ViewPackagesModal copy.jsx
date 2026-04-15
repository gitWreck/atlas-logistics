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
  faChevronLeft,
  faChevronRight,
  faPen,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";
import SplitShipmentModal from "./SplitShipmentModal";
import PackageBulkActionBar from "./PackageBulkActionBar";
import AddPackageForm from "./AddPackageForm";
import {
  getModalThemeClasses,
  getTableTheme,
} from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];
const ITEMS_PER_PAGE = 6;

const isPackageLocked = (status) =>
  ["IN_TRANSIT", "DELIVERED"].includes(status);

const INITIAL_PACKAGE_STATE = {
  description: "",
  weight: "",
  declaredValue: "",
  packagingType: "Box",
  isFragile: false,
  isPerishable: false,
  status: "RECEIVED",
};

export default function ViewPackagesModal({
  isOpen,
  onClose,
  shipment,
  isLocked,
  onRefresh,
  isDark = false,
}) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedIndices, setSelectedIndices] = useState(new Set());

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [isAdding, setIsAdding] = useState(false);
  const [newPackage, setNewPackage] = useState(INITIAL_PACKAGE_STATE);

  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const modalTheme = getModalThemeClasses(isDark);
  const modalAction = getModalActionClasses();
  const tableTheme = getTableTheme(isDark);

  useEffect(() => {
    if (isOpen && shipment?.id) {
      fetchFullShipmentDetails(shipment.id);
    } else {
      setPackages([]);
      setEditingId(null);
      setIsAdding(false);
      setSelectedIndices(new Set());
      setCurrentPage(1);
    }
  }, [isOpen, shipment]);

  const fetchFullShipmentDetails = async (id) => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/shipments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load");

      const json = await res.json();
      setPackages(json.shipment?.packages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const paginatedPackages = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return packages.slice(start, start + ITEMS_PER_PAGE);
  }, [packages, currentPage]);

  const totalPages = Math.max(1, Math.ceil(packages.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSelectAll = () => {
    if (selectedIndices.size === packages.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(packages.map((_, i) => i)));
    }
  };

  const handleSelectOne = (index) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndices(next);
  };

  const saveUpdates = async (updatedPackages) => {
    try {
      setIsSaving(true);

      await updateShipmentPackages({
        shipmentId: shipment.id,
        packages: updatedPackages,
      });

      setPackages(updatedPackages);
      setEditingId(null);
      setIsAdding(false);
      setSelectedIndices(new Set());
      setNewPackage(INITIAL_PACKAGE_STATE);

      onRefresh?.();
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkStatusChange = (newStatus) => {
    if (selectedIndices.size === 0) return;

    const updated = packages.map((pkg, idx) => {
      if (!selectedIndices.has(idx) || pkg.status === "DELIVERED") return pkg;
      return { ...pkg, status: newStatus };
    });

    saveUpdates(updated);
  };

  const handleRemove = (idx) => {
    if (!confirm("Remove this package?")) return;
    saveUpdates(packages.filter((_, i) => i !== idx));
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

  const canSplit = useMemo(() => {
    if (selectedIndices.size === 0) return false;

    return Array.from(selectedIndices).every(
      (idx) => packages[idx]?.status === "RECEIVED",
    );
  }, [selectedIndices, packages]);

  if (!isOpen || !shipment) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className={`absolute inset-0 ${modalTheme.overlay}`}
          onClick={onClose}
        />

        <div
          className={`relative w-full max-w-7xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border ${modalTheme.modal}`}
        >
          {/* HEADER */}
          <div
            className={`flex items-center justify-between p-6 border-b ${modalTheme.header}`}
          >
            <div>
              <div
                className={`text-xs font-bold uppercase tracking-wider mb-1 ${modalTheme.accentText}`}
              >
                Shipment Contents
              </div>

              <h2
                className={`text-xl font-bold flex items-center gap-3 ${modalTheme.title}`}
              >
                <FontAwesomeIcon
                  icon={faBoxOpen}
                  className={modalTheme.label}
                />
                {shipment.shipmentId}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg ${modalTheme.closeButton}`}
            >
              <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
          </div>

          {/* BULK ACTION BAR */}
          {selectedIndices.size > 0 && (
            <div className="px-6 pt-4">
              <PackageBulkActionBar
                selectedCount={selectedIndices.size}
                canSplit={canSplit}
                handleSplitClick={() => setIsSplitModalOpen(true)}
                handleBulkStatusChange={handleBulkStatusChange}
                isLocked={isLocked}
                isSaving={isSaving}
                isDark={isDark}
              />
            </div>
          )}

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* LEFT SIDE */}
              <div className="xl:col-span-4 space-y-4">
                {/* Details */}
                <div
                  className={`border rounded-xl p-4 ${modalTheme.statsCard}`}
                >
                  <div className="flex items-center gap-4">
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
                        {packages.length} package/s
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
                        {packages
                          .map((pkg) => pkg.quantity)
                          .reduce((a, b) => a + b, 0)}{" "}
                        count
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add new item */}
                <div
                  className={`border rounded-xl p-4 ${modalTheme.panelSurface}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div
                        className={`text-[10px] font-bold uppercase ${modalTheme.label}`}
                      >
                        Package Form
                      </div>
                      <div className={`text-sm font-bold ${modalTheme.title}`}>
                        Add New Item
                      </div>
                    </div>

                    {/* {!isAdding && (
                      <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className={modalAction.primaryInlineCompact}
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    )} */}
                  </div>

                  {isAdding ? (
                    <AddPackageForm
                      newPackage={newPackage}
                      setNewPackage={setNewPackage}
                      setIsAdding={setIsAdding}
                      handleAddSave={handleAddSave}
                      isSaving={isSaving}
                      isDark={isDark}
                      packagingTypes={PACKAGING_TYPES}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAdding(true)}
                      className={`w-full py-6 border-2 border-dashed rounded-xl text-xs font-bold uppercase flex flex-col items-center gap-2 ${modalTheme.label} ${modalTheme.panelSurface}`}
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
                  className={`border rounded-xl overflow-hidden ${tableTheme.container}`}
                >
                  {/* TABLE HEADER */}
                  <div
                    className={`px-4 sm:px-6 py-4 border-b flex items-center justify-between gap-4 ${tableTheme.header}`}
                  >
                    <div>
                      <h3 className={`font-bold ${tableTheme.headingText}`}>
                        Package Items
                      </h3>
                      <p className={`text-xs ${tableTheme.emptyText}`}>
                        Manage, edit, and review shipment contents
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className={`flex items-center gap-2 text-xs font-bold ${tableTheme.linkButton}`}
                    >
                      <FontAwesomeIcon
                        icon={
                          selectedIndices.size === packages.length &&
                          packages.length > 0
                            ? faCheckSquare
                            : faSquare
                        }
                        className={
                          selectedIndices.size > 0
                            ? tableTheme.checkboxActive || "text-blue-500"
                            : tableTheme.checkboxIdle || "text-slate-400"
                        }
                      />
                      Select All
                    </button>
                  </div>

                  {/* TABLE BODY */}
                  <div className="overflow-x-auto">
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
                          paginatedPackages.map((pkg, pageIdx) => {
                            const actualIdx = startIndex + pageIdx;
                            const isSelected = selectedIndices.has(actualIdx);
                            const locked =
                              isLocked || isPackageLocked(pkg.status);
                            const isEditing = editingId === actualIdx;

                            const statusClass =
                              pkg.status === "LOADED"
                                ? isDark
                                  ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30"
                                  : "bg-emerald-100 text-emerald-700 border-emerald-300"
                                : pkg.status === "IN_TRANSIT"
                                  ? isDark
                                    ? "bg-blue-900/30 text-blue-400 border-blue-500/30"
                                    : "bg-blue-100 text-blue-700 border-blue-300"
                                  : pkg.status === "DELIVERED"
                                    ? isDark
                                      ? "bg-purple-900/30 text-purple-400 border-purple-500/30"
                                      : "bg-purple-100 text-purple-700 border-purple-300"
                                    : isDark
                                      ? "bg-slate-800 text-slate-400 border-slate-700"
                                      : "bg-slate-100 text-slate-600 border-slate-300";

                            return (
                              <tr
                                key={actualIdx}
                                className={`transition-all ${
                                  isSelected
                                    ? "bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500"
                                    : tableTheme.rowHover
                                }`}
                              >
                                {/* SEQUENCE / SELECT */}
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectOne(actualIdx)}
                                    >
                                      <FontAwesomeIcon
                                        icon={
                                          isSelected ? faCheckSquare : faSquare
                                        }
                                        className={
                                          isSelected
                                            ? tableTheme.checkboxActive ||
                                              "text-blue-500"
                                            : tableTheme.checkboxIdle ||
                                              "text-slate-400"
                                        }
                                      />
                                    </button>

                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-mono font-bold ${
                                        isDark
                                          ? "bg-slate-900 border-slate-800 text-slate-500"
                                          : "bg-slate-100 border-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {pkg.sequence || actualIdx + 1}
                                    </span>
                                  </div>
                                </td>

                                {/* DETAILS */}
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
                                          {PACKAGING_TYPES.map((type) => (
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

                                        <span className="text-blue-500 font-bold">
                                          {pkg.quantity || 1} pcs
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </td>

                                {/* TRACKING */}
                                <td className="px-4 py-3">
                                  <span className="font-mono text-[11px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                    {pkg.packageId}
                                  </span>
                                </td>

                                {/* STATUS */}
                                <td className="px-4 py-3">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${statusClass}`}
                                  >
                                    {pkg.status?.replaceAll("_", " ")}
                                  </span>
                                </td>

                                {/* ACTIONS */}
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
                                          disabled={locked}
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
                  {!loading && packages.length > 0 && (
                    <div
                      className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${tableTheme.footer}`}
                    >
                      <span>
                        Showing{" "}
                        <span className={`font-bold ${tableTheme.footerBold}`}>
                          {startIndex + 1}
                        </span>
                        -
                        <span className={`font-bold ${tableTheme.footerBold}`}>
                          {Math.min(
                            startIndex + ITEMS_PER_PAGE,
                            packages.length,
                          )}
                        </span>{" "}
                        of {packages.length}
                      </span>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${tableTheme.paginationButton}`}
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages),
                            )
                          }
                          disabled={currentPage === totalPages}
                          className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${tableTheme.paginationButton}`}
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className={`p-4 border-t flex justify-end ${modalTheme.header}`}>
            {/* <button
              type="button"
              onClick={onClose}
              className={modalTheme.secondaryButton}
            >
              Close
            </button> */}
          </div>
        </div>
      </div>

      {isSplitModalOpen && (
        <SplitShipmentModal
          isOpen={isSplitModalOpen}
          onClose={() => setIsSplitModalOpen(false)}
          originalShipmentId={shipment.id}
          isDark={isDark}
          onSuccess={() => {
            setIsSplitModalOpen(false);
            onClose();
            onRefresh?.();
          }}
          selectedItems={Array.from(selectedIndices).map(
            (idx) => packages[idx],
          )}
        />
      )}
    </>
  );
}
