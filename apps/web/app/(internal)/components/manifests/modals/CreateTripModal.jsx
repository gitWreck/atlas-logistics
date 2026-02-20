"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faTruckPickup,
  faRoute,
} from "@fortawesome/free-solid-svg-icons";
import { createTruckTrip } from "@/app/utility/FirebaseFunctions";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

// Sub-components
import RouteSelector from "../CreateTripModal/RouteSelector";
import ScheduleSection from "../CreateTripModal/ScheduleSection";
import VehicleDetails from "../CreateTripModal/VehicleDetails";

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
  tripType: "TRANSFER", // NEW: Default to inter-warehouse
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

    // Only require Destination if it's a TRANSFER. Local pickups might just return to the origin.
    if (formData.tripType === "TRANSFER" && !formData.destinationCode) {
      setError("Destination is required for Warehouse Transfers.");
      return;
    }

    if (
      formData.destinationCode &&
      formData.originCode === formData.destinationCode
    ) {
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
        // If it's a local pickup without a specific destination hub, use origin as the anchor
        destinationCity: formData.destination || formData.origin,
        destinationCode: formData.destinationCode || formData.originCode,
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
        <div className="overflow-y-auto max-h-[80vh] custom-scrollbar">
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* --- NEW: TRIP TYPE TOGGLE --- */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex">
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({ ...p, tripType: "TRANSFER" }))
                }
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${formData.tripType === "TRANSFER" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <FontAwesomeIcon icon={faRoute} /> Warehouse Transfer
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({ ...p, tripType: "LOCAL" }))
                }
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${formData.tripType === "LOCAL" ? "bg-amber-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <FontAwesomeIcon icon={faTruckPickup} /> Local Pickup Route
              </button>
            </div>

            <RouteSelector
              formData={formData}
              onWarehouseChange={handleWarehouseChange}
              // You can pass the tripType down to RouteSelector if you want to
              // conditionally hide/make optional the Destination dropdown, just like we did in ReceivePackageForm.
              isLocalRoute={formData.tripType === "LOCAL"}
            />

            <ScheduleSection formData={formData} setFormData={setFormData} />
            <VehicleDetails formData={formData} setFormData={setFormData} />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center font-bold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2 transition-colors"
              >
                {loading ? "Creating..." : "Create Trip"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
