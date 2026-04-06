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
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { TRUCK_STATUSES } from "@/app/utility/constant/templates";

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
    status: "IDLE",
    payloadCapacity: "",
    registrationExpiry: "",
    lastPmsOdometer: "",
    currentOdometer: "",
    lastOilChange: "",
    lastTireChange: "",
  });

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();
  const isEdit = !!initialData;

  useEffect(() => {
    if (isOpen) {
      setFormData({
        plateNumber: initialData?.plateNumber || "",
        model: initialData?.model || "",
        type: initialData?.type || "10-Wheeler Wing Van",
        status: initialData?.status || "IDLE",
        payloadCapacity: initialData?.payloadCapacity || "",
        registrationExpiry: initialData?.registrationExpiry || "",
        lastPmsOdometer: initialData?.lastPmsOdometer || "",
        currentOdometer:
          initialData?.currentOdometer || initialData?.lastPmsOdometer || "",
        lastOilChange: initialData?.lastOilChange || "",
        lastTireChange: initialData?.lastTireChange || "",
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

      onRefresh?.();
      onClose?.();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // const handleToggleStatus = async () => {
  //   if (
  //     !confirm(
  //       `Change status to ${initialData.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}?`,
  //     )
  //   ) {
  //     return;
  //   }

  //   setLoading(true);
  //   try {
  //     await updateTruckStatus({
  //       truckId: initialData.id,
  //       status: initialData.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
  //       plateNumber: initialData.plateNumber,
  //     });

  //     onRefresh?.();
  //     onClose?.();
  //   } catch (err) {
  //     alert(err.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-md rounded-xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${theme.modal}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex justify-between items-center ${theme.header}`}
        >
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
            {isEdit
              ? `Edit Truck: ${initialData.plateNumber}`
              : "Register New Truck"}
          </h3>

          <button type="button" onClick={onClose} className={theme.closeButton}>
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
                icon={faTruck}
                theme={theme}
              />

              <InputField
                label="Truck Model"
                placeholder="Isuzu Giga"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                required
                theme={theme}
              />
            </div>

            <div className={`p-3 rounded-lg border ${theme.panelSurface}`}>
              <label
                className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${theme.accentText}`}
              >
                <FontAwesomeIcon icon={faTruck} /> Truck Type
              </label>

              <select
                value={formData.type}
                onChange={(e) => handleChange("type", e.target.value)}
                className={`w-full border rounded-lg p-2 text-xs outline-none focus:border-blue-500 appearance-none cursor-pointer ${theme.input}`}
              >
                <option>12-Wheeler Wing Van</option>
                <option>12-Wheeler Closed Van</option>
                <option>10-Wheeler Wing Van</option>
                <option>8-Wheeler Wing Van</option>
                <option>6-Wheeler Closed Van</option>
                <option>6-Wheeler Boom Truck</option>
                <option>6-Wheeler Wing Van</option>
                <option>4-Wheeler Reefer</option>
              </select>
            </div>

            <div className={`p-3 rounded-lg border ${theme.panelSurface}`}>
              <label
                className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${theme.accentText}`}
              >
                <FontAwesomeIcon icon={faCheck} /> Truck Status
              </label>

              <select
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className={`w-full border rounded-lg p-2 text-xs outline-none focus:border-blue-500 appearance-none cursor-pointer ${theme.input}`}
              >
                {[...TRUCK_STATUSES].map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <InputField
              label="Max Payload (KG)"
              icon={faWeightHanging}
              type="number"
              value={formData.payloadCapacity}
              onChange={(e) => handleChange("payloadCapacity", e.target.value)}
              required
              theme={theme}
            />
          </div>

          {/* Compliance Section */}
          <div
            className={`p-3 rounded-lg border space-y-4 ${theme.panelSurface}`}
          >
            <p
              className={`text-[10px] font-bold uppercase flex items-center gap-2 text-emerald-500`}
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
                theme={theme}
              />

              <InputField
                label="Last PMS ODO"
                type="number"
                icon={faTools}
                placeholder="e.g. 45000"
                value={formData.lastPmsOdometer}
                onChange={(e) =>
                  handleChange("lastPmsOdometer", e.target.value)
                }
                required
                theme={theme}
              />

              <InputField
                label="Current ODO"
                type="number"
                placeholder="e.g. 47000"
                value={formData.currentOdometer}
                onChange={(e) =>
                  handleChange("currentOdometer", e.target.value)
                }
                required
                theme={theme}
              />

              <InputField
                label="Last Oil Change (ODO)"
                type="number"
                icon={faTools}
                placeholder="e.g. 50000"
                value={formData.lastOilChange}
                onChange={(e) => handleChange("lastOilChange", e.target.value)}
                theme={theme}
              />

              <InputField
                label="Last Tires Change (ODO)"
                type="number"
                icon={faWrench}
                placeholder="e.g. 40000"
                value={formData.lastTireChange}
                onChange={(e) => handleChange("lastTireChange", e.target.value)}
                theme={theme}
              />
            </div>
          </div>

          {/* Edit-only Status Toggle */}
          {/* {isEdit && (
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
          )} */}

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={theme.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className={action.primaryInline}
            >
              {loading ? (
                <FontAwesomeIcon icon={faCircleNotch} spin />
              ) : (
                <FontAwesomeIcon icon={faSave} />
              )}
              {loading ? "Saving..." : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({ label, icon, theme, ...props }) {
  return (
    <div className="space-y-1">
      <label
        className={`text-[10px] font-bold uppercase flex items-center gap-2 ${theme.label}`}
      >
        {icon && <FontAwesomeIcon icon={icon} className="text-[9px]" />}
        {label}
      </label>

      <input
        className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme.input}`}
        {...props}
      />
    </div>
  );
}
