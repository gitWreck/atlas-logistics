import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PackageBulkActions } from "./PackageBulkActions";
import { PackageItemCard } from "./PackageItemCard";
import { PackageStatusCard } from "./PackageStatusCard";

import { auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
  faBoxOpen,
  faChevronLeft,
  faChevronRight,
  faCube,
  faPlus,
  faSearch,
  faSnowflake,
  faTimes,
  faWeightHanging,
  faWineGlass,
} from "@fortawesome/free-solid-svg-icons";

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
  isLocked: parentLocked,
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

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // You can adjust this number

  const filteredAndPaginatedPackages = useMemo(() => {
    // 1. Filter based on Search
    const filtered = packages.filter(
      (pkg) =>
        pkg.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // 2. Calculate Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

    return { paginated, totalPages, totalFiltered: filtered.length };
  }, [packages, searchQuery, currentPage]);

  // Reset page if search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

      const splitFn = httpsCallable(functions, "splitShipment");
      const result = await splitFn({
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        style={{ width: "min(95vw, 1200px)", height: "85vh" }}
        className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* 1. HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 rounded-t-xl shrink-0">
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

        {/* 2. THE BODY: Using Flex instead of Grid for better reliability */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* LEFT COLUMN: Sidebar (Fixed Width) */}
          <div className="w-[300px] shrink-0 border-r border-slate-800 bg-slate-950/20 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              <PackageStatusCard
                icon={faCube}
                label="Count"
                value={`${packages.length} items`}
              />
              <PackageStatusCard
                icon={faWeightHanging}
                label="Total Weight"
                value={`${packages.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0).toFixed(2)} kg`}
              />
            </div>

            <div className="pt-6 border-t border-slate-800">
              {isAdding ? (
                <div className="bg-blue-500/5 border border-blue-500/30 p-4 rounded-xl space-y-4 animate-in fade-in zoom-in-95">
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
                  className="w-full py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-all font-bold text-xs uppercase flex flex-col items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add Item
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: List & Actions (Takes remaining space) */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {/* Bulk Actions & Search (Sticky Top of right side) */}
            <div className="bg-slate-950/40 border-b border-slate-800 shrink-0">
              <PackageBulkActions
                selectedCount={selectedIndices.size}
                canSplit={canSplit}
                isLocked={parentLocked}
                isSaving={isSaving}
                onSplit={handleSplitShipment}
                onStatusChange={handleBulkStatusChange}
              />
              <div className="p-4 relative">
                <FontAwesomeIcon
                  icon={faSearch}
                  style={{ left: "30px" }}
                  className="absolute top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <input
                  type="text"
                  placeholder="Search by description or barcode..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Scrollable Package List */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-3">
              {filteredAndPaginatedPackages.paginated.map((pkg, idx) => {
                // Find original index for editing/selection logic
                const originalIdx = packages.findIndex(
                  (p) => p.trackingNumber === pkg.trackingNumber,
                );

                return (
                  <PackageItemCard
                    key={pkg.trackingNumber || originalIdx}
                    pkg={pkg}
                    idx={originalIdx}
                    isEditing={editingId === originalIdx}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    isSelected={selectedIndices.has(originalIdx)}
                    onSelect={handleSelectOne}
                    onEdit={handleEditClick}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={handleEditSave}
                    onRemove={handleRemove}
                    isLocked={isPackageLocked(pkg.status)}
                    isSaving={isSaving}
                  />
                );
              })}

              {/* EMPTY STATE */}
              {filteredAndPaginatedPackages.totalFiltered === 0 &&
                !isAdding && (
                  <div className="p-10 text-center text-slate-500 italic">
                    No packages found matching "{searchQuery}"
                  </div>
                )}

              {/* PAGINATION CONTROLS */}
              {filteredAndPaginatedPackages.totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-slate-800 mt-4">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">
                    Page {currentPage} of{" "}
                    {filteredAndPaginatedPackages.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(
                            filteredAndPaginatedPackages.totalPages,
                            p + 1,
                          ),
                        )
                      }
                      disabled={
                        currentPage === filteredAndPaginatedPackages.totalPages
                      }
                      className="p-2 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 rounded-b-xl flex justify-end shrink-0">
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
