"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruckMoving,
  faCircleNotch,
  faMapMarkerAlt,
  faIdCard,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { getFunctions, httpsCallable } from "firebase/functions";
// import { functions } from "@/lib/firebase";

export default function CreateTripModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    originCode: "",
    destCode: "",
    driverName: "",
    driverId: "",
    truckPlateNumber: "",
    truckInternalCode: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        originCode: "",
        destCode: "",
        driverName: "",
        driverId: "",
        truckPlateNumber: "",
        truckInternalCode: "",
      });
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Basic Validation
    if (!formData.originCode.trim() || !formData.destCode.trim()) {
      setError("Origin and Destination codes are required.");
      return;
    }

    setLoading(true);

    // try {
    //   const createFn = httpsCallable(functions, "createTruckTrip");

    //   const payload = {
    //     ...formData,
    //     idempotencyKey: Date.now().toString(),
    //   };

    //   const result = await createFn(payload);

    //   console.log("Trip Created:", result.data);

    //   onSuccess();
    //   onClose();
    // } catch (err) {
    //   console.error(err);
    //   setError(err.message || "Failed to create trip. Check permissions.");
    // } finally {
    //   setLoading(false);
    // }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h3 className="text-white font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faTruckMoving} className="text-blue-500" />
            Create New Trip
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section 1: Route (Required) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Route Codes <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FontAwesomeIcon
                  icon={faMapMarkerAlt}
                  className="absolute left-3 top-3 text-slate-500 text-xs"
                />
                <input
                  name="originCode"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none uppercase font-mono"
                  placeholder="ORG (e.g. MNL)"
                  maxLength={4}
                  value={formData.originCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      originCode: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
              <div className="text-slate-600">
                <FontAwesomeIcon icon={faArrowRight} />
              </div>
              <div className="relative flex-1">
                <FontAwesomeIcon
                  icon={faMapMarkerAlt}
                  className="absolute left-3 top-3 text-slate-500 text-xs"
                />
                <input
                  name="destCode"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none uppercase font-mono"
                  placeholder="DST (e.g. CEB)"
                  maxLength={4}
                  value={formData.destCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destCode: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Trip ID will be auto-generated:{" "}
              <span className="font-mono text-slate-400">
                TRIP-YYYYMMDD-ORG-DST-####
              </span>
            </p>
          </div>

          <hr className="border-slate-800" />

          {/* Section 2: Driver & Truck (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Driver Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Driver Name
              </label>
              <input
                name="driverName"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Juan Cruz"
                value={formData.driverName}
                onChange={handleChange}
              />
            </div>

            {/* Truck Plate */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Plate Number
              </label>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faIdCard}
                  className="absolute left-3 top-2.5 text-slate-500 text-xs"
                />
                <input
                  name="truckPlateNumber"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white focus:border-blue-500 focus:outline-none uppercase"
                  placeholder="ABC-1234"
                  value={formData.truckPlateNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      truckPlateNumber: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>

            {/* Driver ID (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Driver ID
              </label>
              <input
                name="driverId"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="Optional ID"
                value={formData.driverId}
                onChange={handleChange}
              />
            </div>

            {/* Truck Code (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Truck Code
              </label>
              <input
                name="truckInternalCode"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none uppercase"
                placeholder="e.g. T-01"
                value={formData.truckInternalCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    truckInternalCode: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <FontAwesomeIcon icon={faTimes} /> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3 rounded-xl font-bold text-white transition-all flex justify-center items-center gap-2
              ${
                loading
                  ? "bg-slate-700 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
              }
            `}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faCircleNotch} spin /> Generating Trip...
              </>
            ) : (
              "Create Trip"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
