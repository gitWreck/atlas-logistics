"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTruck } from "@fortawesome/free-solid-svg-icons";
import { createTruckTrip } from "@/app/utility/FirebaseFunctions";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

// Sub-components
import RouteSelector from "../RouteSelector";
import ScheduleSection from "../ScheduleSection";
import VehicleDetails from "../VehicleDetails";

const INITIAL_FORM_STATE = {
  origin: "",
  originCode: "",
  destination: "",
  destinationCode: "",
  scheduledDeparture: "",
  estimatedArrival: "",
  helperName: "",
  driverName: "",
  driverId: null,
  truckPlateNumber: "",
  truckId: null,
};

export default function CreateTripModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  useEffect(() => {
    if (isOpen) setFormData(INITIAL_FORM_STATE);
  }, [isOpen]);

  const handleWarehouseChange = (type, value) => {
    const selected = WAREHOUSES.find((w) => w.name === value);
    const code = selected ? selected.code : "";
    setFormData((prev) => ({
      ...prev,
      [type]: value,
      [`${type}Code`]: code,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.originCode === formData.destinationCode) {
      setError("Origin and Destination cannot be the same.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createTruckTrip({
        ...formData,
        truckPlateNumber: formData.truckPlateNumber.toUpperCase(),
        originCity: formData.origin,
        destinationCity: formData.destination,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create trip.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
            Create New Trip
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <RouteSelector
            formData={formData}
            onWarehouseChange={handleWarehouseChange}
          />
          <ScheduleSection formData={formData} setFormData={setFormData} />
          <VehicleDetails formData={formData} setFormData={setFormData} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? "Creating..." : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
