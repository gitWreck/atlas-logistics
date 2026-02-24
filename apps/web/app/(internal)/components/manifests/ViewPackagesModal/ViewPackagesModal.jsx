"use client";
import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTimes,
  faSpinner,
  faCube,
  faWeightHanging,
  faPlus,
  faTrash,
  faPen,
  faSave,
  faBan,
  faWineGlass,
  faSnowflake,
  faCheckSquare,
  faSquare,
  faTruckLoading,
  faDolly,
  faArrowsSplitUpAndLeft,
} from "@fortawesome/free-solid-svg-icons";
import { auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { splitShipments } from "@/app/utility/FirebaseFunctions";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

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

  useEffect(() => {
    if (isOpen && shipment?.id) {
      fetchFullShipmentDetails(shipment.id);
    } else {
      setPackages([]);
      setEditingId(null);
      setIsAdding(false);
      setSelectedIndices(new Set());
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
      console.error("Error fetching packages:", err);
    } finally {
      setLoading(false);
    }
  };

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
      const updateFn = httpsCallable(functions, "updateShipmentPackages");
      await updateFn({ shipmentId: shipment.id, packages: updatedPackages });
      setPackages(updatedPackages);
      setEditingId(null);
      setIsAdding(false);
      setSelectedIndices(new Set());
      setNewPackage(INITIAL_PACKAGE_STATE);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkStatusChange = (newStatus) => {
    if (selectedIndices.size === 0) return;
    const updated = packages.map((pkg, idx) => {
      if (!selectedIndices.has(idx)) return pkg;
      if (pkg.status === "DELIVERED") return pkg;
      return { ...pkg, status: newStatus };
    });
    saveUpdates(updated);
  };

  const handleRemove = (idx) => {
    if (!confirm("Remove this package?")) return;
    const updated = packages.filter((_, i) => i !== idx);
    saveUpdates(updated);
  };

  const handleEditClick = (pkg, idx) => {
    setEditingId(idx);
    setEditForm({ ...pkg });
  };

  const handleEditSave = () => {
    const updated = [...packages];
    updated[editingId] = editForm;
    saveUpdates(updated);
  };

  const handleAddSave = () => {
    if (!newPackage.description) return alert("Description required");

    const nextSequence = packages.length + 1;
    const generatedTracking = `${shipment.trackingNumber}-${String(
      nextSequence,
    ).padStart(2, "0")}`;

    const packageToAdd = {
      description: newPackage.description,
      weight: Number(newPackage.weight) || 0,
      declaredValue: Number(newPackage.declaredValue) || 0,
      packagingType: newPackage.packagingType,
      isFragile: newPackage.isFragile,
      isPerishable: newPackage.isPerishable,
      status: "RECEIVED",
      sequence: nextSequence,
      trackingNumber: generatedTracking,
      currentLocation: "",
      isDelayed: false,
      loadedAt: null,
      loadedOnTrip: null,
      height: "",
      length: "",
      width: "",
    };

    const updated = [...packages, packageToAdd];
    saveUpdates(updated);
  };

  const canSplit = useMemo(() => {
    if (selectedIndices.size === 0) return false;
    return Array.from(selectedIndices).every((idx) => {
      const pkg = packages[idx];
      return pkg.status === "RECEIVED";
    });
  }, [selectedIndices, packages]);

  const handleSplitShipment = async () => {
    if (
      !confirm(
        `Create a new shipment with these ${selectedIndices.size} items?`,
      )
    )
      return;

    try {
      setIsSaving(true);
      const barcodesToSplit = Array.from(selectedIndices).map(
        (idx) => packages[idx].trackingNumber,
      );

      const result = await splitShipments({
        originalShipmentId: shipment.id,
        itemsToSplit: barcodesToSplit,
      });

      alert(
        "Shipment Split Successfully! New Tracking: " +
          result.data.newShipmentId,
      );

      onClose();
      if (onRefresh) onRefresh();
    } catch (error) {
      alert("Split Failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !shipment) return null;

  const containerClasses = isDark
    ? "bg-slate-900 border border-slate-700 text-white"
    : "bg-white border border-slate-200 text-slate-900";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 ${containerClasses}`}
      >
        {/* HEADER */}
        <div
          className={`flex items-center justify-between p-6 border-b rounded-t-xl ${
            isDark
              ? "border-slate-800 bg-slate-950/50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div>
            <div
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                isDark ? "text-blue-400" : "text-blue-600"
              }`}
            >
              Shipment Contents
            </div>
            <h2
              className={`text-xl font-bold flex items-center gap-3 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              <FontAwesomeIcon
                icon={faBoxOpen}
                className={isDark ? "text-slate-500" : "text-slate-600"}
              />
              {shipment.trackingNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`transition-colors p-2 rounded-lg ${
              isDark
                ? "text-slate-500 hover:text-white hover:bg-slate-800"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* BULK ACTION BAR */}
        {selectedIndices.size > 0 && (
          <div
            className={`px-6 py-3 flex items-center justify-between ${
              isDark
                ? "bg-blue-900/20 border-b border-blue-500/20"
                : "bg-blue-50 border-b border-blue-200"
            }`}
          >
            <div
              className={`text-xs font-bold ${
                isDark ? "text-blue-300" : "text-blue-700"
              }`}
            >
              {selectedIndices.size} Items Selected
            </div>
            <div className="flex gap-2">
              {canSplit && (
                <button
                  onClick={handleSplitShipment}
                  disabled={isLocked || isSaving}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors mr-auto disabled:opacity-50"
                  title="Create new shipment from selected items"
                >
                  <FontAwesomeIcon icon={faArrowsSplitUpAndLeft} /> Split
                </button>
              )}

              <button
                onClick={() => handleBulkStatusChange("RECEIVED")}
                disabled={isLocked || isSaving}
                className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50 ${
                  isDark
                    ? "bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700"
                }`}
              >
                <FontAwesomeIcon icon={faDolly} /> Unload
              </button>
              <button
                onClick={() => handleBulkStatusChange("LOADED")}
                disabled={isLocked || isSaving}
                className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 transition-colors shadow-lg disabled:opacity-50 ${
                  isDark
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
                }`}
              >
                <FontAwesomeIcon icon={faTruckLoading} /> Load
              </button>
            </div>
          </div>
        )}

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* STATS */}
          <div className="flex gap-4 mb-6">
            <div
              className={`px-5 py-3 rounded-xl flex items-center gap-4 flex-1 border ${
                isDark
                  ? "bg-slate-800/30 border-slate-700"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <FontAwesomeIcon
                icon={faCube}
                className="text-slate-500 text-lg"
              />
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Count
                </div>
                <div
                  className={`text-base font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {packages.length} items
                </div>
              </div>
            </div>
            <div
              className={`px-5 py-3 rounded-xl flex items-center gap-4 flex-1 border ${
                isDark
                  ? "bg-slate-800/30 border-slate-700"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <FontAwesomeIcon
                icon={faWeightHanging}
                className="text-slate-500 text-lg"
              />
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Total Weight
                </div>
                <div
                  className={`text-base font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {packages.reduce(
                    (acc, curr) => acc + (Number(curr.weight) || 0),
                    0,
                  )}{" "}
                  kg
                </div>
              </div>
            </div>
          </div>

          {/* LIST */}
          <div className="space-y-4">
            {/* Header Row with Checkbox */}
            <div
              className={`flex items-center gap-4 px-4 pb-2 border-b mb-2 ${
                isDark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <button
                onClick={handleSelectAll}
                className={`hover:text-white transition-colors ${
                  isDark ? "" : "hover:text-slate-900"
                }`}
              >
                <FontAwesomeIcon
                  icon={
                    selectedIndices.size > 0 &&
                    selectedIndices.size === packages.length
                      ? faCheckSquare
                      : faSquare
                  }
                  className={
                    selectedIndices.size > 0
                      ? "text-blue-500"
                      : isDark
                      ? "text-slate-700"
                      : "text-slate-400"
                  }
                />
              </button>
              <span
                className={`text-[10px] uppercase font-bold ${
                  isDark ? "text-slate-500" : "text-slate-600"
                }`}
              >
                Select All Packages
              </span>
            </div>

            {loading ? (
              <div
                className={`text-center py-10 flex flex-col items-center gap-2 ${
                  isDark ? "text-slate-500" : "text-slate-600"
                }`}
              >
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <span>Loading packages...</span>
              </div>
            ) : (
              <>
                {packages.map((pkg, idx) => {
                  const locked = isPackageLocked(pkg.status);
                  const isEditingThis = editingId === idx;
                  const isSelected = selectedIndices.has(idx);

                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-4 transition-all group ${
                        isEditingThis
                          ? isDark
                            ? "border-blue-500 ring-1 ring-blue-500/20 bg-slate-900"
                            : "border-blue-500 ring-1 ring-blue-500/20 bg-blue-50"
                          : isSelected
                          ? isDark
                            ? "border-blue-500/50 bg-blue-900/10"
                            : "border-blue-500/50 bg-blue-50"
                          : isDark
                          ? "border-slate-800 bg-slate-950 hover:border-slate-600"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        {/* SELECTION CHECKBOX */}
                        <div className="pt-3">
                          <button onClick={() => handleSelectOne(idx)}>
                            <FontAwesomeIcon
                              icon={isSelected ? faCheckSquare : faSquare}
                              className={
                                isSelected
                                  ? "text-blue-500"
                                  : isDark
                                  ? "text-slate-700 group-hover:text-slate-500"
                                  : "text-slate-400 group-hover:text-slate-600"
                              }
                            />
                          </button>
                        </div>

                        {/* SEQUENCE */}
                        <div
                          className={`h-10 w-10 rounded-lg flex flex-shrink-0 items-center justify-center text-sm font-mono font-bold border ${
                            isDark
                              ? "bg-slate-900 text-slate-500 border-slate-800"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {pkg.sequence || idx + 1}
                        </div>

                        <div className="flex-1 space-y-2">
                          {isEditingThis ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <label
                                  className={`text-[10px] uppercase font-bold ${
                                    isDark
                                      ? "text-slate-500"
                                      : "text-slate-600"
                                  }`}
                                >
                                  Description
                                </label>
                                <input
                                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${
                                    isDark
                                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                                      : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                                  }`}
                                  value={editForm.description}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      description: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label
                                  className={`text-[10px] uppercase font-bold ${
                                    isDark
                                      ? "text-slate-500"
                                      : "text-slate-600"
                                  }`}
                                >
                                  Type
                                </label>
                                <select
                                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${
                                    isDark
                                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                                      : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                                  }`}
                                  value={editForm.packagingType}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      packagingType: e.target.value,
                                    })
                                  }
                                >
                                  {PACKAGING_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label
                                  className={`text-[10px] uppercase font-bold ${
                                    isDark
                                      ? "text-slate-500"
                                      : "text-slate-600"
                                  }`}
                                >
                                  Weight (kg)
                                </label>
                                <input
                                  type="number"
                                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${
                                    isDark
                                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                                      : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                                  }`}
                                  value={editForm.weight}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      weight: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="col-span-2 flex gap-2 pt-1">
                                <button
                                  onClick={() =>
                                    setEditForm((p) => ({
                                      ...p,
                                      isFragile: !p.isFragile,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                                    editForm.isFragile
                                      ? isDark
                                        ? "bg-amber-500/10 border-amber-500 text-amber-400"
                                        : "bg-amber-500/10 border-amber-500 text-amber-600"
                                      : isDark
                                      ? "bg-slate-900 border-slate-700 text-slate-500"
                                      : "bg-white border-slate-300 text-slate-500"
                                  }`}
                                >
                                  <FontAwesomeIcon icon={faWineGlass} /> Fragile
                                </button>
                                <button
                                  onClick={() =>
                                    setEditForm((p) => ({
                                      ...p,
                                      isPerishable: !p.isPerishable,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                                    editForm.isPerishable
                                      ? isDark
                                        ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                                        : "bg-cyan-500/10 border-cyan-500 text-cyan-600"
                                      : isDark
                                      ? "bg-slate-900 border-slate-700 text-slate-500"
                                      : "bg-white border-slate-300 text-slate-500"
                                  }`}
                                >
                                  <FontAwesomeIcon icon={faSnowflake} />{" "}
                                  Perishable
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className={`text-base font-bold ${
                                  isDark ? "text-slate-200" : "text-slate-900"
                                }`}
                              >
                                {pkg.description || "Item"}
                              </div>
                              <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
                                <span
                                  className={`px-2 py-0.5 rounded border ${
                                    isDark
                                      ? "bg-slate-900 border-slate-700 text-slate-400"
                                      : "bg-slate-100 border-slate-300 text-slate-600"
                                  }`}
                                >
                                  {pkg.packagingType || "Box"}
                                </span>
                                {pkg.isFragile && (
                                  <span className="text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 rounded">
                                    Fragile
                                  </span>
                                )}
                                {pkg.isPerishable && (
                                  <span className="text-cyan-500 font-bold bg-cyan-500/10 border border-cyan-500/20 px-1.5 rounded">
                                    Perishable
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap justify-between items-center text-xs text-slate-500">
                                <span className="font-mono">
                                  {pkg.trackingNumber}
                                </span>
                                <span className="px-2 py-0.5 rounded-full border border-slate-300 text-slate-600 text-[10px] uppercase font-bold">
                                  {pkg.status}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-col gap-2 items-end">
                          {isEditingThis ? (
                            <>
                              <button
                                onClick={handleEditSave}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center gap-2 disabled:opacity-50"
                              >
                                <FontAwesomeIcon icon={faSave} /> Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 ${
                                  isDark
                                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                                    : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                                }`}
                              >
                                <FontAwesomeIcon icon={faBan} /> Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditClick(pkg, idx)}
                                disabled={isLocked}
                                className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-2 disabled:opacity-50 ${
                                  isDark
                                    ? "bg-slate-800 hover:bg-slate-700 text-slate-100"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                }`}
                              >
                                <FontAwesomeIcon icon={faPen} /> Edit
                              </button>
                              {!locked && (
                                <button
                                  onClick={() => handleRemove(idx)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold rounded flex items-center gap-2"
                                >
                                  <FontAwesomeIcon icon={faTrash} /> Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ADD NEW PACKAGE CARD */}
                {isAdding ? (
                  <div
                    className={`border p-4 rounded-xl space-y-3 ${
                      isDark
                        ? "bg-blue-500/5 border-blue-500/30"
                        : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div
                      className={`text-xs font-bold uppercase mb-2 ${
                        isDark ? "text-blue-400" : "text-blue-600"
                      }`}
                    >
                      New Package Details
                    </div>
                    <input
                      placeholder="Description (e.g. Large Box)"
                      className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                          : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                      }`}
                      value={newPackage.description}
                      onChange={(e) =>
                        setNewPackage((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${
                          isDark
                            ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                            : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                        }`}
                        value={newPackage.packagingType}
                        onChange={(e) =>
                          setNewPackage((p) => ({
                            ...p,
                            packagingType: e.target.value,
                          }))
                        }
                      >
                        {PACKAGING_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Weight (kg)"
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${
                          isDark
                            ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                            : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                        }`}
                        value={newPackage.weight}
                        onChange={(e) =>
                          setNewPackage((p) => ({
                            ...p,
                            weight: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Value (PHP)"
                        className={`border rounded-lg px-3 py-2 text-sm outline-none ${
                          isDark
                            ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                            : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                        }`}
                        value={newPackage.declaredValue}
                        onChange={(e) =>
                          setNewPackage((p) => ({
                            ...p,
                            declaredValue: e.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() =>
                            setNewPackage((p) => ({
                              ...p,
                              isFragile: !p.isFragile,
                            }))
                          }
                          className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            newPackage.isFragile
                              ? "bg-amber-500/10 border-amber-500 text-amber-500"
                              : isDark
                              ? "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500"
                              : "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400"
                          }`}
                        >
                          <FontAwesomeIcon icon={faWineGlass} /> Fragile
                        </button>
                        <button
                          onClick={() =>
                            setNewPackage((p) => ({
                              ...p,
                              isPerishable: !p.isPerishable,
                            }))
                          }
                          className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            newPackage.isPerishable
                              ? "bg-cyan-500/10 border-cyan-500 text-cyan-500"
                              : isDark
                              ? "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500"
                              : "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400"
                          }`}
                        >
                          <FontAwesomeIcon icon={faSnowflake} /> Perishable
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setIsAdding(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                          isDark
                            ? "text-slate-400 hover:text-white"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddSave}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save Package"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    className={`w-full py-6 border-2 border-dashed rounded-xl transition-all font-bold text-xs uppercase flex flex-col items-center gap-2 ${
                      isDark
                        ? "border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/30"
                        : "border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300"
                    }`}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Add Item
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div
          className={`p-4 border-t rounded-b-xl flex justify-end ${
            isDark
              ? "border-slate-800 bg-slate-950/50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-6 py-2.5 text-sm font-bold rounded-lg border transition-colors ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                : "bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}