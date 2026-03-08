import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PackageBulkActions } from "../PackageBulkActionBar";
import { PackageItemCard } from "../PackageItemCard";
import { PackageStatusCard } from "../PackageStatusCard";

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

      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
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

        <PackageBulkActions
          selectedCount={selectedIndices.size}
          canSplit={canSplit}
          isLocked={parentLocked}
          isSaving={isSaving}
          onSplit={handleSplitShipment}
          onStatusChange={handleBulkStatusChange}
        />

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex gap-4 mb-6">
            <PackageStatusCard
              icon={faCube}
              label="Count"
              value={`${packages.length} items`}
            />
            <PackageStatusCard
              icon={faWeightHanging}
              label="Total Weight"
              //   value={`${totalweight} kg`}
            />
          </div>

          <div className="space-y-4">
            {/* SEARCH FILTER */}
            <div className="relative mb-4">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
              />
              <input
                type="text"
                placeholder="Search description or tracking #..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* MAPPED LIST (Using paginated data) */}
            <div className="space-y-4">
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

              {/* ADD NEW ITEM FORM (Logic remains unchanged) */}
              {isAdding ? (
                <div className="bg-slate-800/30 border border-blue-500/50 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                  {/* ... (Keep your existing New Package Details form here) ... */}
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                >
                  <FontAwesomeIcon icon={faPlus} /> Add Another Package
                </button>
              )}
            </div>
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
