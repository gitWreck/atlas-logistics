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

// --- CONSTANTS ---
const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

const isPackageLocked = (status) => {
  return ["IN_TRANSIT", "DELIVERED"].includes(status); // Allow unloading if just LOADED
};

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
}) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Selection State
  const [selectedIndices, setSelectedIndices] = useState(new Set());

  // Editing/Adding State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [newPackage, setNewPackage] = useState(INITIAL_PACKAGE_STATE);

  // --- 1. FETCH LOGIC ---
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

  // --- 2. SELECTION HANDLERS ---
  const handleSelectAll = () => {
    if (selectedIndices.size === packages.length) {
      setSelectedIndices(new Set());
    } else {
      // Create a set of all indices (0 to n-1)
      setSelectedIndices(new Set(packages.map((_, i) => i)));
    }
  };

  const handleSelectOne = (index) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setSelectedIndices(newSet);
  };

  // --- 3. ACTIONS ---
  const saveUpdates = async (updatedPackages) => {
    try {
      setIsSaving(true);
      const updateFn = httpsCallable(functions, "updateShipmentPackages");

      await updateFn({
        shipmentId: shipment.id,
        packages: updatedPackages,
      });

      setPackages(updatedPackages);
      setEditingId(null);
      setIsAdding(false);
      setSelectedIndices(new Set()); // Clear selection after save

      // Reset Form
      setNewPackage(INITIAL_PACKAGE_STATE);
    } catch (err) {
      console.error(err);
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // NEW: Bulk Load/Unload
  const handleBulkStatusChange = (newStatus) => {
    if (selectedIndices.size === 0) return;

    const updatedPackages = packages.map((pkg, idx) => {
      if (selectedIndices.has(idx)) {
        // Prevent changing if locked (e.g. Delivered)
        if (pkg.status === "DELIVERED") return pkg;
        return { ...pkg, status: newStatus };
      }
      return pkg;
    });

    saveUpdates(updatedPackages);
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

    // 1. Calculate Sequence
    const nextSequence = packages.length + 1;

    // 2. Generate Tracking Number
    const generatedTracking = `${shipment.trackingNumber}-${String(nextSequence).padStart(2, "0")}`;

    // 3. Create the Complete Object (Matching your Firestore Schema)
    const packageToAdd = {
      // -- Fields from Form --
      description: newPackage.description,
      weight: Number(newPackage.weight) || 0, // Ensure Number
      declaredValue: Number(newPackage.declaredValue) || 0, // Ensure Number
      packagingType: newPackage.packagingType,
      isFragile: newPackage.isFragile,
      isPerishable: newPackage.isPerishable,
      status: "RECEIVED", // Default status

      // -- Generated Fields --
      sequence: nextSequence,
      trackingNumber: generatedTracking,

      // -- Default/Empty Fields (To match your schema) --
      currentLocation: "", // or shipment.originCode if you prefer
      isDelayed: false,
      loadedAt: null,
      loadedOnTrip: null,

      // Dimensions (Initialize as empty strings to match your example)
      height: "",
      length: "",
      width: "",
    };

    // 4. Update & Save
    const updated = [...packages, packageToAdd];
    saveUpdates(updated);
  };

  const canSplit = useMemo(() => {
    if (selectedIndices.size === 0) return false;
    // Check if ALL selected items are "RECEIVED" (not loaded/delivered)
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

      // Get the actual barcodes/IDs of the selected items
      const barcodesToSplit = Array.from(selectedIndices).map(
        (idx) => packages[idx].trackingNumber,
      );

      // const splitFn = httpsCallable(functions, "splitShipment");
      const result = await splitShipments({
        originalShipmentId: shipment.id,
        itemsToSplit: barcodesToSplit, // Pass the array of barcodes
      });

      alert(
        "Shipment Split Successfully! New Tracking: " +
          result.data.newShipmentId,
      );

      onClose(); // Close modal (data will refresh when parent reloads)
    } catch (error) {
      alert("Split Failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !shipment) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 rounded-t-xl">
          <div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
              Shipment Contents
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <FontAwesomeIcon icon={faBoxOpen} className="text-slate-500" />
              {shipment.trackingNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* BULK ACTION BAR (Only visible when items selected) */}
        {selectedIndices.size > 0 && (
          <div className="bg-blue-900/20 border-b border-blue-500/20 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="text-xs font-bold text-blue-300">
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
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold rounded flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faDolly} /> Unload
              </button>
              <button
                onClick={() => handleBulkStatusChange("LOADED")}
                disabled={isLocked || isSaving}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50"
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
            <div className="bg-slate-800/30 border border-slate-700 px-5 py-3 rounded-xl flex items-center gap-4 flex-1">
              <FontAwesomeIcon
                icon={faCube}
                className="text-slate-500 text-lg"
              />
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Count
                </div>
                <div className="text-base font-bold text-white">
                  {packages.length} items
                </div>
              </div>
            </div>
            <div className="bg-slate-800/30 border border-slate-700 px-5 py-3 rounded-xl flex items-center gap-4 flex-1">
              <FontAwesomeIcon
                icon={faWeightHanging}
                className="text-slate-500 text-lg"
              />
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Total Weight
                </div>
                <div className="text-base font-bold text-white">
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
            <div className="flex items-center gap-4 px-4 pb-2 border-b border-slate-800 mb-2">
              <button
                onClick={handleSelectAll}
                className="hover:text-white transition-colors"
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
                      : "text-slate-700"
                  }
                />
              </button>
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Select All Packages
              </span>
            </div>

            {loading ? (
              <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <span>Loading packages...</span>
              </div>
            ) : (
              <>
                {/* --- EXISTING ITEMS --- */}
                {packages.map((pkg, idx) => {
                  const isLocked = isPackageLocked(pkg.status);
                  const isEditingThis = editingId === idx;
                  const isSelected = selectedIndices.has(idx);

                  return (
                    <div
                      key={idx}
                      className={`bg-slate-950 border rounded-xl p-4 transition-all group ${
                        isEditingThis
                          ? "border-blue-500 ring-1 ring-blue-500/20"
                          : isSelected
                            ? "border-blue-500/50 bg-blue-900/5"
                            : "border-slate-800 hover:border-slate-600"
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
                                  : "text-slate-700 group-hover:text-slate-500"
                              }
                            />
                          </button>
                        </div>

                        {/* SEQUENCE */}
                        <div className="h-10 w-10 bg-slate-900 border border-slate-800 rounded-lg flex flex-shrink-0 items-center justify-center text-sm font-mono text-slate-500 font-bold">
                          {pkg.sequence || idx + 1}
                        </div>

                        <div className="flex-1 space-y-2">
                          {isEditingThis ? (
                            /* --- EDIT MODE --- */
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <label className="text-[10px] uppercase text-slate-500 font-bold">
                                  Description
                                </label>
                                <input
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
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
                                <label className="text-[10px] uppercase text-slate-500 font-bold">
                                  Type
                                </label>
                                <select
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
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
                                <label className="text-[10px] uppercase text-slate-500 font-bold">
                                  Weight (kg)
                                </label>
                                <input
                                  type="number"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
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
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${editForm.isFragile ? "bg-amber-500/10 border-amber-500 text-amber-500" : "bg-slate-900 border-slate-700 text-slate-500"}`}
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
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${editForm.isPerishable ? "bg-cyan-500/10 border-cyan-500 text-cyan-500" : "bg-slate-900 border-slate-700 text-slate-500"}`}
                                >
                                  <FontAwesomeIcon icon={faSnowflake} />{" "}
                                  Perishable
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* --- VIEW MODE --- */
                            <>
                              <div className="text-base font-bold text-slate-200">
                                {pkg.description || "Item"}
                              </div>
                              <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
                                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400">
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
                              <div className="flex gap-4 mt-1 text-sm">
                                {/* <div className="font-mono text-slate-400">
                                  {pkg.weight}{" "}
                                  <span className="text-xs text-slate-600">
                                    kg
                                  </span>
                                </div> */}
                                {pkg.declaredValue > 0 && (
                                  <div className="font-mono text-emerald-500">
                                    ₱ {pkg.declaredValue}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* STATUS & ACTIONS */}
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${
                              pkg.status === "LOADED"
                                ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30"
                                : pkg.status === "RECEIVED"
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-blue-900/30 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {pkg.status}
                          </span>

                          <div className="flex gap-1 mt-1">
                            {isEditingThis ? (
                              <>
                                <button
                                  onClick={handleEditSave}
                                  disabled={isSaving}
                                  className="h-8 w-8 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center"
                                >
                                  <FontAwesomeIcon icon={faSave} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  disabled={isSaving}
                                  className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded flex items-center justify-center"
                                >
                                  <FontAwesomeIcon icon={faTimes} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditClick(pkg, idx)}
                                  disabled={isLocked || isSaving}
                                  className="h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded flex items-center justify-center disabled:opacity-30"
                                >
                                  <FontAwesomeIcon
                                    icon={isLocked ? faBan : faPen}
                                    className="text-xs"
                                  />
                                </button>
                                <button
                                  onClick={() => handleRemove(idx)}
                                  disabled={isLocked || isSaving}
                                  className="h-8 w-8 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded flex items-center justify-center disabled:opacity-30"
                                >
                                  <FontAwesomeIcon
                                    icon={isLocked ? faBan : faTrash}
                                    className="text-xs"
                                  />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* --- ADD NEW ITEM ROW --- */}
                {/* ... (Add form remains the same as previous) ... */}
                {/* I excluded the full Add Form HTML here for brevity, keep your existing logic */}
                {isAdding ? (
                  <div className="bg-slate-800/30 border border-blue-500/50 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs font-bold text-blue-400 uppercase mb-3">
                      New Package Details
                    </div>
                    <div className="mb-3">
                      <input
                        placeholder="Description (e.g. Large Box)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                        value={newPackage.description}
                        onChange={(e) =>
                          setNewPackage({
                            ...newPackage,
                            description: e.target.value,
                          })
                        }
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <select
                        className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                        value={newPackage.packagingType}
                        onChange={(e) =>
                          setNewPackage({
                            ...newPackage,
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
                      <input
                        type="number"
                        placeholder="Weight (kg)"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                        value={newPackage.weight}
                        onChange={(e) =>
                          setNewPackage({
                            ...newPackage,
                            weight: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <input
                        type="number"
                        placeholder="Value (PHP)"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                        value={newPackage.declaredValue}
                        onChange={(e) =>
                          setNewPackage({
                            ...newPackage,
                            declaredValue: e.target.value,
                          })
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
                          className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${newPackage.isFragile ? "bg-amber-500/10 border-amber-500 text-amber-500" : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500"}`}
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
                          className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${newPackage.isPerishable ? "bg-cyan-500/10 border-cyan-500 text-cyan-500" : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500"}`}
                        >
                          <FontAwesomeIcon icon={faSnowflake} /> Perishable
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddSave}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-colors"
                      >
                        {isSaving ? "Saving..." : "Save Package"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Another Package
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
