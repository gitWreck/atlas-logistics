// app/admin/manifest/CreateTripModal.jsx
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faRoute,
  faCalendarDays,
} from "@fortawesome/free-solid-svg-icons";
import { createTruckTrip } from "@/app/utility/FirebaseFunctions";
import DriverSelectInput from "../DriverSelectInput";
import { PROVINCES, getCities } from "@/app/utility/PhilippinesData";

export default function CreateTripModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    originProvince: "",
    originCity: "",
    originCode: "", // Will be auto-filled

    destinationProvince: "",
    destinationCity: "",
    destinationCode: "",

    // 2. Add Schedule State
    scheduledDeparture: "",
    estimatedArrival: "",
    helperName: "",

    driverName: "", // For display
    driverId: null, // For backend logic (Optional)
    truckPlateNumber: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        originCity: "",
        originCode: "",
        originProvince: "",
        destinationCity: "",
        destinationCode: "",
        destinationProvince: "",

        scheduledDeparture: "",
        estimatedArrival: "",
        helperName: "",

        driverName: "",
        driverId: null,
        truckPlateNumber: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to handle City selection and Code lookup
  const handleCityChange = (type, cityName, provinceName) => {
    const cityList = getCities(provinceName);
    const selected = cityList.find((c) => c.name === cityName);
    const code = selected ? selected.code : "GEN";

    if (type === "origin") {
      setFormData((prev) => ({
        ...prev,
        originCity: cityName,
        originCode: code,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        destinationCity: cityName,
        destinationCode: code,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Call the backend function you provided
      const results = await createTruckTrip({
        originCity: formData.originCity.toUpperCase(),
        destinationCity: formData.destinationCity.toUpperCase(),
        originCode: formData.originCode.toUpperCase(),
        destinationCode: formData.destinationCode.toUpperCase(),

        scheduledDeparture: formData.scheduledDeparture,
        estimatedArrival: formData.estimatedArrival,
        helperName: formData.helperName,

        truckPlateNumber: formData.truckPlateNumber,
        driverName: formData.driverName,
        driverId: formData.driverId,
      });

      onSuccess(); // Trigger refresh in parent
      onClose(); // Close modal
      console.log("results: ", results);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create trip.");
    } finally {
      setLoading(false);
    }
  };

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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* --- ROUTE SECTION (UPDATED) --- */}
          <div className="space-y-4">
            {/* ORIGIN */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
                  <FontAwesomeIcon icon={faRoute} /> Origin
                </label>
                {formData.originCode && (
                  <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-1.5 rounded">
                    {formData.originCode}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Province Dropdown */}
                <select
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500"
                  value={formData.originProvince}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      originProvince: e.target.value,
                      originCity: "",
                      originCode: "",
                    }))
                  }
                  required
                >
                  <option value="">Select Province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {/* City Dropdown */}
                <select
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500 disabled:opacity-50"
                  value={formData.originCity}
                  onChange={(e) =>
                    handleCityChange(
                      "origin",
                      e.target.value,
                      formData.originProvince,
                    )
                  }
                  disabled={!formData.originProvince}
                  required
                >
                  <option value="">Select City</option>
                  {getCities(formData.originProvince).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DESTINATION */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-2">
                  <FontAwesomeIcon icon={faRoute} /> Destination
                </label>
                {formData.destCode && (
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 rounded">
                    {formData.destCode}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500"
                  value={formData.destinationProvince}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      destinationProvince: e.target.value,
                      destinationCity: "",
                      destinationCode: "",
                    }))
                  }
                  required
                >
                  <option value="">Select Province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <select
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500 disabled:opacity-50"
                  value={formData.destCity}
                  onChange={(e) =>
                    handleCityChange(
                      "destination",
                      e.target.value,
                      formData.destinationProvince,
                    )
                  }
                  disabled={!formData.destinationProvince}
                  required
                >
                  <option value="">Select City</option>
                  {getCities(formData.destinationProvince).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* --- 4. NEW SCHEDULE SECTION --- */}
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 grid grid-cols-2 gap-4">
            {/* Departure (Existing) */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faCalendarDays} /> Departure
              </label>
              <input
                type="datetime-local"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                value={formData.scheduledDeparture}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    scheduledDeparture: e.target.value,
                  }))
                }
              />
            </div>

            {/* 4. NEW: ARRIVAL (ETA) */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faCalendarDays} /> Est. Arrival
              </label>
              <input
                type="datetime-local"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                value={formData.estimatedArrival}
                min={formData.scheduledDeparture} // Prevent ETA before Departure
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    estimatedArrival: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Details Section */}
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

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Truck Helper / Pahinante
              </label>
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none"
                placeholder="Optional Name"
                value={formData.helperName}
                onChange={(e) =>
                  setFormData({ ...formData, helperName: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Truck Plate #
              </label>
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none uppercase"
                placeholder="e.g. ABC-1234"
                value={formData.truckPlateNumber}
                onChange={(e) =>
                  setFormData({ ...formData, truckPlateNumber: e.target.value })
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
