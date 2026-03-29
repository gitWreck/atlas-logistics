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
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";
import { PackageItemCard } from "./PackageItemCard";
import SplitShipmentModal from "./SplitShipmentModal";
import PackageBulkActionBar from "./PackageBulkActionBar";
import AddPackageForm from "./AddPackageForm";

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
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && shipment?.id) fetchFullShipmentDetails(shipment.id);
    else {
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === packages.length) setSelectedIndices(new Set());
    else setSelectedIndices(new Set(packages.map((_, i) => i)));
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
      if (onRefresh) onRefresh();
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

  const handleEditSave = () => {
    const updated = [...packages];
    updated[editingId] = editForm;
    saveUpdates(updated);
  };

  const handleAddSave = () => {
    if (!newPackage.description) return alert("Description required");
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
      trackingNumber: `${shipment.trackingNumber}-${String(nextSequence).padStart(2, "0")}`,
      currentLocation: "",
      loadedAt: null,
      loadedOnTrip: null,
    };
    saveUpdates([...packages, packageToAdd]);
  };

  const canSplit = useMemo(() => {
    if (selectedIndices.size === 0) return false;
    return Array.from(selectedIndices).every(
      (idx) => packages[idx].status === "RECEIVED",
    );
  }, [selectedIndices, packages]);

  if (!isOpen || !shipment) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 ${isDark ? "bg-slate-900 border border-slate-700 text-white" : "bg-white border border-slate-200 text-slate-900"}`}
      >
        {/* HEADER */}
        <div
          className={`flex items-center justify-between p-6 border-b rounded-t-xl ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"}`}
        >
          <div>
            <div
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? "text-blue-400" : "text-blue-600"}`}
            >
              Shipment Contents
            </div>
            <h2 className="text-xl font-bold flex items-center gap-3">
              <FontAwesomeIcon
                icon={faBoxOpen}
                className={isDark ? "text-slate-500" : "text-slate-600"}
              />
              {shipment.trackingNumber}
            </h2>
          </div>
          {/* <button onClick={onClose} className="p-2 rounded-lg">
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button> */}
        </div>

        {/* BULK ACTION BAR */}
        {selectedIndices.size > 0 && (
          <PackageBulkActionBar
            selectedCount={selectedIndices.size}
            canSplit={canSplit}
            handleSplitClick={() => setIsSplitModalOpen(true)}
            handleBulkStatusChange={handleBulkStatusChange}
            isLocked={isLocked}
            isSaving={isSaving}
            isDark={isDark}
          />
        )}

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex gap-4 mb-6">
            <div
              className={`px-5 py-3 rounded-xl flex items-center gap-4 flex-1 border ${isDark ? "bg-slate-800/30 border-slate-700" : "bg-slate-100 border-slate-200"}`}
            >
              <FontAwesomeIcon
                icon={faCube}
                className="text-slate-500 text-lg"
              />
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Count
                </div>
                <div className="text-base font-bold">
                  {packages.length} items
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className={`flex items-center gap-4 px-4 pb-2 border-b mb-2 ${isDark ? "border-slate-800" : "border-slate-200"}`}
            >
              <button onClick={handleSelectAll}>
                <FontAwesomeIcon
                  icon={
                    selectedIndices.size === packages.length
                      ? faCheckSquare
                      : faSquare
                  }
                  className={
                    selectedIndices.size > 0
                      ? "text-blue-500"
                      : "text-slate-400"
                  }
                />
              </button>
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Select All Packages
              </span>
            </div>

            {loading ? (
              <div className="text-center py-10 flex flex-col items-center gap-2 text-slate-500">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <span>Loading packages...</span>
              </div>
            ) : (
              <>
                {packages.map((pkg, idx) => (
                  <PackageItemCard
                    key={idx}
                    pkg={pkg}
                    idx={idx}
                    isEditing={editingId === idx}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    isSelected={selectedIndices.has(idx)}
                    onSelect={handleSelectOne}
                    onEdit={(p, i) => {
                      setEditingId(i);
                      setEditForm({ ...p });
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={handleEditSave}
                    onRemove={handleRemove}
                    isLocked={isLocked || isPackageLocked(pkg.status)}
                    isSaving={isSaving}
                    isDark={isDark}
                  />
                ))}
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
                    onClick={() => setIsAdding(true)}
                    className="w-full py-6 border-2 border-dashed rounded-xl text-xs font-bold uppercase flex flex-col items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Item
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className={`p-4 border-t rounded-b-xl flex justify-end ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"}`}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold rounded-lg border"
          >
            Close
          </button>
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
            if (onRefresh) onRefresh();
          }}
          selectedItems={Array.from(selectedIndices).map(
            (idx) => packages[idx],
          )}
        />
      )}
    </div>
  );
}
