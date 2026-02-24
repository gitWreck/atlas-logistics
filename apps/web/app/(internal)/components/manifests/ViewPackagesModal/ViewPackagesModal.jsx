import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PackageBulkActions } from "./PackageBulkActions";
import { PackageItemCard } from "./PackageItemCard";
import { PackageStatusCard } from "./PackageStatusCard";

import { auth } from "@/lib/firebase";
import {
  faBoxOpen,
  faCheckSquare,
  faChevronLeft,
  faChevronRight,
  faCube,
  faPlus,
  faSearch,
  faSnowflake,
  faSquare,
  faTimes,
  faWeightHanging,
  faWineGlass,
  faBox,
  faCamera,
  faExpand,
  faChevronUp,
  faChevronDown,
  faTrash,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import {
  splitShipments,
  updateShipmentImages,
} from "@/app/utility/FirebaseFunctions";

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
  onRefresh,
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

  // --- NEW IMAGE STATE ---
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // We initialize these from the shipment object
  const [receiptImages, setReceiptImages] = useState(
    shipment?.proofOfReceipt || [],
  );
  const [deliveryImages, setDeliveryImages] = useState(
    shipment?.proofOfDelivery || [],
  );

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

  useEffect(() => {
    if (shipment) {
      setReceiptImages(shipment.proofOfReceipt || []);
      setDeliveryImages(shipment.proofOfDelivery || []);
    }
  }, [shipment]);

  // --- IMAGE HANDLERS ---
  const handleAddImage = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsSaving(true);
      // TODO: Replace with your actual upload logic to Firebase Storage
      // const downloadURL = await uploadImageToStorage(file, shipment.id);

      // Placeholder for testing UI before backend integration
      const downloadURL = URL.createObjectURL(file);

      const updatedImages =
        type === "receipt"
          ? [...receiptImages, downloadURL]
          : [...deliveryImages, downloadURL];

      // Update Local State
      if (type === "receipt") setReceiptImages(updatedImages);
      else setDeliveryImages(updatedImages);

      // Call your backend to save the new image array to the shipment document
      await updateShipmentImages({
        shipmentId: shipment.id,
        type,
        images: updatedImages,
      });
    } catch (err) {
      alert("Error uploading image: " + err.message);
    } finally {
      setIsSaving(false);
      // Reset input
      e.target.value = null;
    }
  };

  const handleRemoveImage = async (urlToRemove, type) => {
    if (!confirm("Remove this image?")) return;

    try {
      setIsSaving(true);
      const updatedImages =
        type === "receipt"
          ? receiptImages.filter((url) => url !== urlToRemove)
          : deliveryImages.filter((url) => url !== urlToRemove);

      // Update Local State
      if (type === "receipt") setReceiptImages(updatedImages);
      else setDeliveryImages(updatedImages);

      // Call your backend to save the updated array
      await updateShipmentImages({
        shipmentId: shipment.id,
        type,
        images: updatedImages,
      });

      // TODO: Optionally delete the actual file from Firebase Storage here
    } catch (err) {
      alert("Error removing image: " + err.message);
    } finally {
      setIsSaving(false);
    }
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

      await updateShipmentPackages({
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
      onRefresh();
    }
  };

  if (!isOpen || !shipment) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative bg-slate-900 border-0 sm:border border-slate-700 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden w-full h-full sm:h-[85vh]"
        style={{ maxWidth: "1200px" }}
      >
        {/* 1. HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-950/50 sm:rounded-t-xl shrink-0 z-10">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
              Shipment Contents
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <FontAwesomeIcon icon={faBoxOpen} className="text-slate-500" />
              {shipment.trackingNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg -mr-2 sm:mr-0"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* 2. THE BODY: 
        Mobile: 'overflow-y-auto' on this wrapper so the whole thing scrolls.
        Desktop: 'overflow-hidden' here, so inner columns can scroll independently.
    */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0 custom-scrollbar">
          {/* LEFT COLUMN / TOP ROW (Sidebar) 
          Mobile: No max-height, no overflow. It just stacks naturally.
          Desktop: Fixed width, independent scroll.
      */}
          <div className="w-full md:w-[400px] shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/20 p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-visible md:overflow-y-auto custom-scrollbar">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
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

            <div className="pt-2 md:pt-6 border-t border-slate-800/50 md:border-slate-800">
              {isAdding ? (
                <div className="bg-blue-500/5 border border-blue-500/30 p-3 sm:p-4 rounded-xl space-y-3 sm:space-y-4 animate-in fade-in zoom-in-95">
                  <div className="text-xs font-bold text-blue-400 uppercase mb-2 sm:mb-3">
                    New Package Details
                  </div>
                  <div>
                    <input
                      placeholder="Description (e.g. Large Box)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
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
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <select
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
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
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                      value={newPackage.weight}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          weight: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <input
                      type="number"
                      placeholder="Value (PHP)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                      value={newPackage.declaredValue}
                      onChange={(e) =>
                        setNewPackage({
                          ...newPackage,
                          declaredValue: e.target.value,
                        })
                      }
                    />
                    <div className="flex gap-1 sm:gap-2 items-center">
                      <button
                        onClick={() =>
                          setNewPackage((p) => ({
                            ...p,
                            isFragile: !p.isFragile,
                          }))
                        }
                        className={`flex-1 h-full rounded-lg border text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${newPackage.isFragile ? "bg-amber-500/10 border-amber-500 text-amber-500" : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500"}`}
                      >
                        <FontAwesomeIcon icon={faWineGlass} />{" "}
                        <span className="hidden sm:inline">Fragile</span>
                      </button>
                      <button
                        onClick={() =>
                          setNewPackage((p) => ({
                            ...p,
                            isPerishable: !p.isPerishable,
                          }))
                        }
                        className={`flex-1 h-full rounded-lg border text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${newPackage.isPerishable ? "bg-cyan-500/10 border-cyan-500 text-cyan-500" : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500"}`}
                      >
                        <FontAwesomeIcon icon={faSnowflake} />{" "}
                        <span className="hidden sm:inline">Perish</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsAdding(false)}
                      className="px-3 sm:px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddSave}
                      disabled={isSaving}
                      className="px-4 sm:px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-colors"
                    >
                      {isSaving ? "Saving..." : "Save Package"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full py-6 md:py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-all font-bold text-xs uppercase flex flex-col md:flex-row items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add Item
                </button>
              )}
            </div>

            {/* GALLERIES */}
            <div className="border-t border-slate-800 mt-2 md:mt-4 -mx-4 sm:-mx-6 pt-2">
              <ImageGallery
                title="Proof of Receipt"
                count={receiptImages.length}
                images={receiptImages}
                icon={faBox}
                onView={setLightboxSrc}
                onAdd={(e) => handleAddImage(e, "receipt")}
                onRemove={(url) => handleRemoveImage(url, "receipt")}
                defaultOpen={false}
                isSaving={isSaving}
              />
              <div className="h-px bg-slate-800 mx-6" />
              <ImageGallery
                title="Proof of Delivery"
                count={deliveryImages.length}
                images={deliveryImages}
                icon={faCamera}
                onView={setLightboxSrc}
                onAdd={(e) => handleAddImage(e, "delivery")}
                onRemove={(url) => handleRemoveImage(url, "delivery")}
                defaultOpen={true}
                isSaving={isSaving}
              />
            </div>
          </div>

          {/* RIGHT COLUMN / BOTTOM ROW: List & Actions 
          Mobile: No independent scrolling. Just flows naturally down.
          Desktop: Flex-col, overflow-hidden wrapper, scrolling inner list.
      */}
          <div className="flex-1 flex flex-col bg-slate-900 md:overflow-hidden min-h-0">
            {/* Bulk Actions & Search (Sticky on Desktop) */}
            <div className="bg-slate-950/40 border-b border-slate-800 shrink-0 sticky top-0 z-10 md:static">
              <PackageBulkActions
                selectedCount={selectedIndices.size}
                canSplit={canSplit}
                isLocked={parentLocked}
                isSaving={isSaving}
                onSplit={handleSplitShipment}
                onStatusChange={handleBulkStatusChange}
              />
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-slate-800 px-4 py-3 gap-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSelectAll}
                    className="hover:text-white transition-colors p-1 -ml-1"
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
                          ? "text-blue-500 text-lg"
                          : "text-slate-700 text-lg"
                      }
                    />
                  </button>
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Select All Packages
                  </span>
                </div>

                <div className="relative w-full sm:w-80">
                  <FontAwesomeIcon
                    icon={faSearch}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Search description or barcode..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 sm:py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Package List 
            Mobile: overflow-visible so it expands fully. 
            Desktop: overflow-y-auto so it scrolls inside its column.
        */}
            <div className="flex-1 overflow-visible md:overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-3 min-h-0">
              {filteredAndPaginatedPackages.paginated.map((pkg, idx) => {
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
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 sm:rounded-b-xl flex justify-end shrink-0 z-10">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="Proof"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-white bg-slate-800/50 p-3 rounded-full hover:bg-slate-700 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>
      )}
    </div>
  );
}

function ImageGallery({
  title,
  count,
  images,
  icon,
  onView,
  onAdd,
  onRemove,
  defaultOpen = false,
  isSaving = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
            <FontAwesomeIcon icon={icon} className="text-xs" />
          </div>
          <span className="text-xs font-bold uppercase text-slate-400 group-hover:text-white transition-colors">
            {title} <span className="text-slate-600">({count})</span>
          </span>
        </div>
        <FontAwesomeIcon
          icon={isOpen ? faChevronUp : faChevronDown}
          className="text-slate-600 text-xs transition-transform duration-300"
        />
      </button>

      {/* Scrollable List */}
      {isOpen && (
        <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
            {/* ADD IMAGE BUTTON */}
            <div className="snap-center shrink-0">
              <label
                className={`w-24 h-24 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${isSaving ? "opacity-50 cursor-not-allowed" : "hover:border-blue-500 hover:text-blue-400 text-slate-500"}`}
              >
                <FontAwesomeIcon icon={faUpload} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Upload
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAdd}
                  disabled={isSaving}
                />
              </label>
            </div>

            {/* EXISTING IMAGES */}
            {images.map((src, idx) => (
              <div
                key={idx}
                className="snap-center shrink-0 relative group block"
              >
                <button
                  onClick={() => onView(src)}
                  className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden relative block hover:border-blue-500 transition-colors"
                >
                  <img
                    src={src}
                    alt={`${title} ${idx + 1}`}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FontAwesomeIcon
                      icon={faExpand}
                      className="text-white drop-shadow-md mb-2"
                    />
                  </div>
                </button>

                {/* REMOVE BUTTON (Shows on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(src);
                  }}
                  disabled={isSaving}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg hover:bg-red-500 border-2 border-slate-900 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
