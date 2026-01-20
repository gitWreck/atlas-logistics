// app/admin/manifest/CreateTripModal.jsx
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faRoute,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { createTruckTrip } from "@/app/utility/FirebaseFunctions";
import DriverSelectInput from "../DriverSelectInput";

export default function CreateTripModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    origin: "Manila", // Default example
    destination: "Cebu", // Default example
    driverName: "", // For display
    driverId: null, // For backend logic (Optional)
    truckPlateNumber: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Call the backend function you provided
      const results = await createTruckTrip({
        origin: formData.origin.toUpperCase(),
        destination: formData.destination.toUpperCase(),
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
          {/* Route Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Origin
              </label>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faRoute}
                  className="absolute left-3 top-3 text-slate-600 text-xs"
                />
                <input
                  required
                  // maxLength={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-8 pr-3 text-white focus:border-blue-500 outline-none uppercase font-mono"
                  placeholder="MNL"
                  value={formData.origin}
                  onChange={(e) =>
                    setFormData({ ...formData, origin: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase">
                Destination
              </label>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faRoute}
                  className="absolute left-3 top-3 text-slate-600 text-xs"
                />
                <input
                  required
                  // maxLength={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-8 pr-3 text-white focus:border-blue-500 outline-none uppercase font-mono"
                  placeholder="CEB"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destCode: e.target.value })
                  }
                />
              </div>
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
