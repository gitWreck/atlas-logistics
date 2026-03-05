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

export default function CreateTripModal({ isOpen, onClose, onSuccess, isDark = false }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div
        className={`w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-xl ${
          isDark
            ? "bg-slate-900 border border-slate-700"
            : "bg-white border border-slate-200"
        }`}
      >
        {/* --- HEADER (Fixed) --- */}
        <div
          className={`p-4 border-b flex justify-between items-center shrink-0 ${
            isDark
              ? "border-slate-800 bg-slate-950"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <h3
            className={`font-bold flex items-center gap-2 text-lg ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
            Create New Trip
          </h3>
          <button
            onClick={onClose}
            className={`transition-colors p-2 -mr-2 ${
              isDark
                ? "text-slate-500 hover:text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* --- SCROLLABLE FORM AREA --- */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          <form
            id="create-trip-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* --- NEW: TRIP TYPE TOGGLE --- */}
            <div
              className={`p-1 rounded-xl border flex ${
                isDark
                  ? "bg-slate-950 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({ ...p, tripType: "TRANSFER" }))
                }
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${
                  formData.tripType === "TRANSFER"
                    ? "bg-blue-600 text-white"
                    : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <FontAwesomeIcon icon={faRoute} /> Warehouse Transfer
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({ ...p, tripType: "LOCAL" }))
                }
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${
                  formData.tripType === "LOCAL"
                    ? "bg-amber-600 text-white"
                    : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <FontAwesomeIcon icon={faTruckPickup} /> Local Pickup Route
              </button>
            </div>

            <RouteSelector
              formData={formData}
              onWarehouseChange={handleWarehouseChange}
              isLocalRoute={formData.tripType === "LOCAL"}
              isDark={isDark}
            />

            <ScheduleSection
              formData={formData}
              setFormData={setFormData}
              isDark={isDark}
            />
            <VehicleDetails
              formData={formData}
              setFormData={setFormData}
              isDark={isDark}
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center font-bold">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* --- FOOTER (Fixed) --- */}
        <div
          className={`p-4 border-t shrink-0 flex gap-3 ${
            isDark
              ? "border-slate-800 bg-slate-950"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 sm:py-2.5 rounded-lg border font-bold text-sm ${
              isDark
                ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                : "border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            // Bind the button to the form ID so it works outside the <form> tag
            form="create-trip-form"
            disabled={loading}
            className="flex-1 py-3 sm:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? "Creating..." : "Create Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
