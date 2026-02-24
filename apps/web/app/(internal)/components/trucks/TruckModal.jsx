"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faSave,
  faBan,
  faCheck,
  faCircleNotch,
  faWeightHanging,
  faTools,
  faCalendarCheck,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import {
  upsertTruck,
  updateTruckStatus,
} from "@/app/utility/FirebaseFunctions";

export default function TruckModal({
  isOpen,
  onClose,
  initialData,
  onRefresh,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    plateNumber: "",
    model: "",
    type: "10-Wheeler Wing Van",
    payload: "",
    registrationExpiry: "",
    lastPmsOdometer: "",
    lastOilChange: "", // NEW
    lastTireChange: "", // NEW
  });

  const isEdit = !!initialData;

  useEffect(() => {
    if (isOpen) {
      setFormData({
        plateNumber: initialData?.plateNumber || "",
        model: initialData?.model || "",
        type: initialData?.type || "10-Wheeler Wing Van",
        payload: initialData?.payload || "",
        registrationExpiry: initialData?.registrationExpiry || "",
        lastPmsOdometer: initialData?.lastPmsOdometer || "",
        lastOilChange: initialData?.lastOilChange || "", // NEW
        lastTireChange: initialData?.lastTireChange || "", // NEW
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await upsertTruck({
        id: initialData?.id || null,
        ...formData,
        plateNumber: formData.plateNumber.toUpperCase(),
      });
      onRefresh();
      onClose();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (
      !confirm(
        `Change status to ${initialData.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}?`,
      )
    )
      return;
    setLoading(true);
    try {
      await updateTruckStatus({
        truckId: initialData.id,
        status: initialData.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
        plateNumber: initialData.plateNumber,
      });
      onRefresh();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex justify-between items-center ${
            isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
          }`}
        >
          <h3
            className={`font-bold flex items-center gap-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            <FontAwesomeIcon
              icon={faTruck}
              className={isDark ? "text-blue-500" : "text-blue-600"}
            />
            {isEdit
              ? `Edit Truck: ${initialData.plateNumber}`
              : "Register New Truck"}
          </h3>
          <button
            onClick={onClose}
            className={`transition-colors ${
              isDark
                ? "text-slate-500 hover:text-white"
                : "text-slate-400 hover:text-slate-900"
            }`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Main Details Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Plate Number"
                placeholder="ABC-1234"
                value={formData.plateNumber}
                onChange={(e) => handleChange("plateNumber", e.target.value)}
                required
              />
              <InputField
                label="Truck Model"
                placeholder="Isuzu Giga"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                required
              />
            </div>

            <div
              className={`p-3 rounded-lg border ${
                isDark
                  ? "bg-slate-950/50 border-slate-800"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <label
                className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${
                  isDark ? "text-blue-400" : "text-blue-700"
                }`}
              >
                <FontAwesomeIcon icon={faTruck} /> Truck Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleChange("type", e.target.value)}
                className={`w-full border rounded-lg p-2 text-xs outline-none focus:border-blue-500 appearance-none cursor-pointer ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white"
                    : "bg-white border-slate-300 text-slate-900"
                }`}
              >
                <option>10-Wheeler Wing Van</option>
                <option>6-Wheeler Closed Van</option>
                <option>4-Wheeler Reefer</option>
                <option>Tractor Head</option>
              </select>
            </div>

            <InputField
              label="Max Payload (KG)"
              icon={faWeightHanging}
              type="number"
              value={formData.payload}
              onChange={(e) => handleChange("payload", e.target.value)}
              required
            />
          </div>

          {/* Compliance Section */}
          <div
            className={`p-3 rounded-lg border space-y-4 ${
              isDark
                ? "bg-slate-950/50 border-slate-800"
                : "bg-emerald-50 border-emerald-200"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase flex items-center gap-2 ${
                isDark ? "text-emerald-400" : "text-emerald-700"
              }`}
            >
              <FontAwesomeIcon icon={faTools} /> Maintenance & Compliance
            </p>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="LTO Expiry"
                type="date"
                icon={faCalendarCheck}
                value={formData.registrationExpiry}
                onChange={(e) =>
                  handleChange("registrationExpiry", e.target.value)
                }
                required
              />
              <InputField
                label="Current ODO"
                type="number"
                value={formData.lastPmsOdometer}
                onChange={(e) =>
                  handleChange("lastPmsOdometer", e.target.value)
                }
                required
              />
              <InputField
                label="Last Oil Change (ODO)"
                type="number"
                icon={faTools}
                placeholder="e.g. 50000"
                value={formData.lastOilChange}
                onChange={(e) => handleChange("lastOilChange", e.target.value)}
              />
              <InputField
                label="Last Tires (ODO)"
                type="number"
                icon={faWrench}
                placeholder="e.g. 40000"
                value={formData.lastTireChange}
                onChange={(e) => handleChange("lastTireChange", e.target.value)}
              />
            </div>
          </div>

          {/* Edit-only Status Toggle */}
          {isEdit && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={loading}
                className={`w-full py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  initialData.status === "ACTIVE"
                    ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                }`}
              >
                <FontAwesomeIcon
                  icon={initialData.status === "ACTIVE" ? faBan : faCheck}
                />
                {initialData.status === "ACTIVE"
                  ? "Disable Truck Asset"
                  : "Enable Truck Asset"}
              </button>
            </div>
          )}

          {/* Actions - Matched to pt-2 and flex gap-3 */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-lg border font-bold text-sm transition-colors ${
                isDark
                  ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <FontAwesomeIcon icon={faCircleNotch} spin />
              ) : (
                <FontAwesomeIcon icon={faSave} />
              )}
              {loading ? "Saving..." : isEdit ? "Update Truck" : "Save Truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({ label, icon, isDark = false, ...props }) {
  return (
    <div className="space-y-1">
      <label
        className={`text-[10px] font-bold uppercase flex items-center gap-2 ${
          isDark ? "text-slate-400" : "text-slate-600"
        }`}
      >
        {icon && <FontAwesomeIcon icon={icon} className="text-[9px]" />} {label}
      </label>
      <input
        className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${
          isDark
            ? "bg-slate-950 border-slate-700 text-white [color-scheme:dark]"
            : "bg-white border-slate-300 text-slate-900 [color-scheme:light]"
        }`}
        {...props}
      />
    </div>
  );
}
