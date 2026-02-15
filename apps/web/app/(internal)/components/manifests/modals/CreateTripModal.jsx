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

export default function CreateTripModal({ isOpen, onClose, onSuccess }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4">
      <div className="bg-slate-900 border-x border-b border-t sm:border-slate-700 sm:rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        {/* --- HEADER (Fixed) --- */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0">
          <h3 className="font-bold text-white flex items-center gap-2 text-lg">
            <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
            Create New Trip
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2 -mr-2"
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
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
                    <FontAwesomeIcon icon={faWarehouse} /> Origin Warehouse
                  </label>
                  {formData.originCode && (
                    <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-1.5 rounded">
                      {formData.originCode}
                    </span>
                  )}
                </div>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-2 text-sm sm:text-xs text-white outline-none focus:border-blue-500 appearance-none cursor-pointer"
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
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-2">
                    <FontAwesomeIcon icon={faRoute} /> Destination Warehouse
                  </label>
                  {formData.destinationCode && (
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 rounded">
                      {formData.destinationCode}
                    </span>
                  )}
                </div>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-2 text-sm sm:text-xs text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer"
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
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                  <FontAwesomeIcon icon={faCalendarDays} /> Departure
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-2 text-sm text-white outline-none focus:border-blue-500 [color-scheme:dark]"
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
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                  <FontAwesomeIcon icon={faCalendarDays} /> Est. Arrival
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-2 text-sm text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
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
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <DriverSelectInput
                value={formData.driverName}
                onChange={(text) =>
                  setFormData((prev) => ({ ...prev, driverName: text }))
                }
                onSelectId={(id) =>
                  setFormData((prev) => ({ ...prev, driverId: id }))
                }
              />

              <TruckSelectInput
                value={formData.truckPlateNumber}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, truckPlateNumber: val }))
                }
                onSelectId={(id) =>
                  setFormData((prev) => ({ ...prev, truckId: id }))
                }
              />

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Truck Helper / Pahinante
                </label>
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 sm:p-2 text-sm text-white outline-none"
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
        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 sm:py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm"
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
