// app/admin/manifest/CreateTripModal.jsx
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faRoute,
  faCalendarDays,
  faWarehouse, // Added icon
} from "@fortawesome/free-solid-svg-icons";
import { createTruckTrip } from "@/app/utility/FirebaseFunctions";
import DriverSelectInput from "../DriverSelectInput";
import { WAREHOUSES } from "@/app/utility/WarehouseData"; // <--- IMPORT THIS
import TruckSelectInput from "../TruckSelectInput";

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
};

export default function CreateTripModal({ isOpen, onClose, onSuccess, isDark = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  useEffect(() => {
    if (isOpen) setFormData(INITIAL_FORM_STATE);
  }, [isOpen]);

  if (!isOpen) return null;

  // --- NEW HANDLER FOR WAREHOUSES ---
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
    setLoading(true);
    setError("");

    try {
      // Check logic to prevent same origin/destination
      if (formData.originCode === formData.destinationCode) {
        throw new Error("Origin and Destination cannot be the same.");
      }

      await createTruckTrip({
        ...formData,
        truckPlateNumber: formData.truckPlateNumber.toUpperCase(),
        originCity: formData.origin,
        destinationCity: formData.destination,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div className={`w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-xl ${
        isDark ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"
      }`}>
        {/* --- HEADER (Fixed) --- */}
        <div className={`p-4 border-b flex justify-between items-center shrink-0 ${
          isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
        }`}>
          <h3 className={`font-bold flex items-center gap-2 text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
            <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
            Create New Trip
          </h3>
          <button
            onClick={onClose}
            className={`transition-colors p-2 -mr-2 ${isDark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* --- SCROLLABLE FORM AREA --- */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <form
            id="create-trip-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* --- ROUTE SECTION --- */}
            <div className="space-y-4">
              {/* ORIGIN SELECTOR */}
              <div className={`p-3 rounded-lg border ${
                isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-[10px] font-bold uppercase flex items-center gap-2 ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}>
                    <FontAwesomeIcon icon={faWarehouse} /> Origin Warehouse
                  </label>
                  {formData.originCode && (
                    <span className={`text-[10px] font-mono px-1.5 rounded ${
                      isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                    }`}>
                      {formData.originCode}
                    </span>
                  )}
                </div>
                <select
                  className={`w-full border rounded-lg p-3 sm:p-2 text-sm sm:text-xs outline-none focus:border-blue-500 appearance-none cursor-pointer ${
                    isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                  value={formData.origin}
                  onChange={(e) =>
                    handleWarehouseChange("origin", e.target.value)
                  }
                  required
                >
                  <option value="">Select Origin...</option>
                  {WAREHOUSES.map((w) => (
                    <option key={w.code} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DESTINATION SELECTOR */}
              <div className={`p-3 rounded-lg border ${
                isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-[10px] font-bold uppercase flex items-center gap-2 ${
                    isDark ? "text-emerald-400" : "text-emerald-700"
                  }`}>
                    <FontAwesomeIcon icon={faRoute} /> Destination Warehouse
                  </label>
                  {formData.destinationCode && (
                    <span className={`text-[10px] font-mono px-1.5 rounded ${
                      isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {formData.destinationCode}
                    </span>
                  )}
                </div>
                <select
                  className={`w-full border rounded-lg p-3 sm:p-2 text-sm sm:text-xs outline-none focus:border-emerald-500 appearance-none cursor-pointer ${
                    isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                  value={formData.destination}
                  onChange={(e) =>
                    handleWarehouseChange("destination", e.target.value)
                  }
                  required
                >
                  <option value="">Select Destination...</option>
                  {WAREHOUSES.filter((w) => w.code !== formData.originCode).map(
                    (w) => (
                      <option key={w.code} value={w.name}>
                        {w.name}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {/* --- SCHEDULE SECTION --- */}
            <div className={`p-3 rounded-lg border grid grid-cols-1 sm:grid-cols-2 gap-4 ${
              isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}>
              <div>
                <label className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}>
                  <FontAwesomeIcon icon={faCalendarDays} /> Departure
                </label>
                <input
                  type="datetime-local"
                  required
                  className={`w-full border rounded-lg p-3 sm:p-2 text-sm outline-none focus:border-blue-500 ${
                    isDark ? "bg-slate-900 border-slate-700 text-white [color-scheme:dark]" : "bg-white border-slate-300 text-slate-900 [color-scheme:light]"
                  }`}
                  value={formData.scheduledDeparture}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      scheduledDeparture: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}>
                  <FontAwesomeIcon icon={faCalendarDays} /> Est. Arrival
                </label>
                <input
                  type="datetime-local"
                  required
                  className={`w-full border rounded-lg p-3 sm:p-2 text-sm outline-none focus:border-emerald-500 ${
                    isDark ? "bg-slate-900 border-slate-700 text-white [color-scheme:dark]" : "bg-white border-slate-300 text-slate-900 [color-scheme:light]"
                  }`}
                  value={formData.estimatedArrival}
                  min={formData.scheduledDeparture}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      estimatedArrival: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* --- DETAILS SECTION --- */}
            <div className={`space-y-4 pt-2 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <DriverSelectInput
                value={formData.driverName}
                onChange={(text) =>
                  setFormData((prev) => ({ ...prev, driverName: text }))
                }
                onSelectId={(id) =>
                  setFormData((prev) => ({ ...prev, driverId: id }))
                }
                isDark={isDark}
              />

              <TruckSelectInput
                value={formData.truckPlateNumber}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, truckPlateNumber: val }))
                }
                onSelectId={(id) =>
                  setFormData((prev) => ({ ...prev, truckId: id }))
                }
                isDark={isDark}
              />

              <div className="space-y-1">
                <label className={`text-xs font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Truck Helper / Pahinante
                </label>
                <input
                  className={`w-full border rounded-lg p-3 sm:p-2 text-sm outline-none ${
                    isDark ? "bg-slate-950 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                  placeholder="Optional Name"
                  value={formData.helperName}
                  onChange={(e) =>
                    setFormData({ ...formData, helperName: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Spacer for bottom scrolling */}
            <div className="h-4"></div>
          </form>
        </div>

        {/* --- FOOTER (Fixed) --- */}
        <div className={`p-4 border-t shrink-0 flex gap-3 ${
          isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 sm:py-2.5 rounded-lg border font-bold text-sm ${
              isDark ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
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
