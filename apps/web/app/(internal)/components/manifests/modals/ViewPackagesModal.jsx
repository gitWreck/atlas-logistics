import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTimes,
  faSpinner,
  faCube,
  faWeightHanging,
  faBarcode,
  faPlus,
  faTrash,
  faPen,
  faSave,
  faBan,
  faWineGlass, // <--- Added
  faSnowflake, // <--- Added
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";

// --- CONSTANTS ---
const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

const isPackageLocked = (status) => {
  return ["LOADED", "IN_TRANSIT", "DELIVERED"].includes(status);
};

export default function ViewPackagesModal({ isOpen, onClose, shipment }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Adding State
  const [isAdding, setIsAdding] = useState(false);
  const [newPackage, setNewPackage] = useState({
    description: "",
    weight: "",
    declaredValue: "",
    packagingType: "Box", // Default
    isFragile: false, // Default
    isPerishable: false, // Default
    status: "RECEIVED",
  });

  // --- FETCH LOGIC ---
  useEffect(() => {
    if (isOpen && shipment?.id) {
      fetchFullShipmentDetails(shipment.id);
    } else {
      setPackages([]);
      setEditingId(null);
      setIsAdding(false);
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

  // --- ACTIONS ---
  const saveUpdates = async (updatedPackages) => {
    try {
      setIsSaving(true);

      // Call it (No need to manually handle headers/tokens!)
      await updateShipmentPackages({
        shipmentId: shipment.id,
        packages: updatedPackages,
      });

      // Success Handling (Local State Update)
      setPackages(updatedPackages);
      setEditingId(null);
      setIsAdding(false);
      setNewPackage({
        description: "",
        weight: "",
        declaredValue: "",
        packagingType: "Box",
        isFragile: false,
        isPerishable: false,
        status: "RECEIVED",
      });
    } catch (err) {
      console.error(err);
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
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
    const updated = [
      ...packages,
      { ...newPackage, sequence: packages.length + 1 },
    ];
    saveUpdates(updated);
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

                  return (
                    <div
                      key={idx}
                      className={`bg-slate-950 border rounded-xl p-4 transition-all ${isEditingThis ? "border-blue-500 ring-1 ring-blue-500/20" : "border-slate-800 hover:border-slate-600"}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="h-10 w-10 bg-slate-900 border border-slate-800 rounded-lg flex flex-shrink-0 items-center justify-center text-sm font-mono text-slate-500 font-bold">
                          {pkg.sequence || idx + 1}
                        </div>

                        <div className="flex-1 space-y-2">
                          {isEditingThis ? (
                            // --- EDIT MODE ---
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
                              {/* Edit Toggles */}
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
                            // --- VIEW MODE ---
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
                                <div className="font-mono text-slate-400">
                                  {pkg.weight}{" "}
                                  <span className="text-xs text-slate-600">
                                    kg
                                  </span>
                                </div>
                                {pkg.declaredValue > 0 && (
                                  <div className="font-mono text-emerald-500">
                                    ₱{pkg.declaredValue}
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
                                ? "bg-blue-900/30 text-blue-400 border-blue-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
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
                {isAdding ? (
                  <div className="bg-slate-800/30 border border-blue-500/50 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs font-bold text-blue-400 uppercase mb-3">
                      New Package Details
                    </div>

                    {/* Row 1: Description */}
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

                    {/* Row 2: Type & Weight */}
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

                    {/* Row 3: Value & Toggles */}
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
