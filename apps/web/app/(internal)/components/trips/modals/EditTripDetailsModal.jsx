"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faPenToSquare,
  faRoute,
  faSave,
  faTimes,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import { updateTripDetails } from "@/app/utility/FirebaseFunctions";
import { WAREHOUSES } from "@/app/utility/WarehouseData";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { updatedBy } from "@/app/utility/utilities";

const INITIAL_FORM_STATE = {
  tripType: "HUB_TRANSFER",
  origin: "",
  originCode: "",
  destination: "",
  destinationCode: "",
};

export default function EditTripDetailsModal({
  isOpen,
  onClose,
  trip,
  onSuccess,
  isDark = false,
  profile,
}) {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  useEffect(() => {
    if (isOpen && trip) {
      setFormData({
        tripType: trip.tripType || "HUB_TRANSFER",
        origin: trip.origin || "",
        originCode: trip.originCode || "",
        destination: trip.destination || "",
        destinationCode: trip.destinationCode || "",
      });
      setLoading(false);
      setError("");
    }
  }, [isOpen, trip]);

  const isWarehouseTransfer = formData.tripType === "HUB_TRANSFER";
  const canEdit = useMemo(() => {
    return (
      trip &&
      trip.active !== false &&
      String(trip.status || "").toUpperCase() === "CREATED" &&
      !trip.manifestLocked &&
      !Number(trip.shipments?.length || 0)
    );
  }, [trip]);

  if (!isOpen || !trip) return null;

  const handleWarehouseChange = (type, value) => {
    const selected = WAREHOUSES.find((warehouse) => warehouse.name === value);

    setFormData((prev) => ({
      ...prev,
      [type]: value,
      [`${type}Code`]: selected?.code || "",
    }));
  };

  const handleTripTypeChange = (tripType) => {
    setFormData((prev) => ({
      ...prev,
      tripType,
      origin: "",
      originCode: "",
      destination: "",
      destinationCode: "",
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canEdit) {
      setError(
        "Trip details can only be edited while the trip is CREATED, unlocked, and has no assigned shipments.",
      );
      return;
    }

    if (isWarehouseTransfer && !formData.originCode) {
      setError("Origin warehouse is required.");
      return;
    }

    if (isWarehouseTransfer && !formData.destinationCode) {
      setError("Destination warehouse is required.");
      return;
    }

    if (
      isWarehouseTransfer &&
      formData.originCode &&
      formData.originCode === formData.destinationCode
    ) {
      setError("Origin and destination cannot be the same.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await updateTripDetails({
        tripId: trip.id,
        ...formData,
        origin: isWarehouseTransfer ? formData.origin : "",
        originCode: isWarehouseTransfer ? formData.originCode : "",
        destination: isWarehouseTransfer ? formData.destination : "",
        destinationCode: isWarehouseTransfer ? formData.destinationCode : "",
        updatedBy: updatedBy(profile),
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Failed to update trip details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-xl overflow-hidden h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-xl border shadow-2xl ${theme.modal}`}
      >
        <div
          className={`p-4 border-b flex justify-between items-center shrink-0 ${theme.header}`}
        >
          <div>
            <h3
              className={`font-bold flex items-center gap-2 text-lg ${theme.title}`}
            >
              <FontAwesomeIcon icon={faPenToSquare} className="text-blue-500" />
              Edit Trip Details
            </h3>
            <p className={`text-xs mt-1 ${theme.helperText}`}>
              Update route details before the trip is loaded or assigned.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`transition-colors p-2 -mr-2 ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        <form
          id="edit-trip-details-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
        >
          <div className={`p-1 rounded-xl border flex gap-1 ${theme.panelSurface}`}>
            <button
              type="button"
              onClick={() => handleTripTypeChange("HUB_TRANSFER")}
              disabled={loading}
              className={
                formData.tripType === "HUB_TRANSFER"
                  ? action.primaryInlineCompact
                  : `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${theme.toggleIdle}`
              }
            >
              <FontAwesomeIcon icon={faRoute} />
              Transfer
            </button>

            <button
              type="button"
              onClick={() => handleTripTypeChange("LOCAL_PICKUP")}
              disabled={loading}
              className={
                formData.tripType === "LOCAL_PICKUP"
                  ? action.warningInline
                  : `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${theme.toggleIdle}`
              }
            >
              <FontAwesomeIcon icon={faTruckPickup} />
              Pickup
            </button>

            <button
              type="button"
              onClick={() => handleTripTypeChange("DELIVERY")}
              disabled={loading}
              className={
                formData.tripType === "DELIVERY"
                  ? "flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                  : `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${theme.toggleIdle}`
              }
            >
              <FontAwesomeIcon icon={faBox} />
              Delivery
            </button>
          </div>

          {isWarehouseTransfer && (
            <div className="space-y-4">
              <WarehouseSelect
                label="Origin Warehouse"
                value={formData.origin}
                code={formData.originCode}
                onChange={(value) => handleWarehouseChange("origin", value)}
                isDark={isDark}
                disabled={loading}
              />

              <WarehouseSelect
                label="Destination Warehouse"
                value={formData.destination}
                code={formData.destinationCode}
                onChange={(value) => handleWarehouseChange("destination", value)}
                isDark={isDark}
                disabled={loading}
                excludedCode={formData.originCode}
              />
            </div>
          )}

          {!canEdit && (
            <div className={theme.errorBox}>
              Trip details can only be edited while the trip is CREATED,
              unlocked, and has no assigned shipments.
            </div>
          )}

          {error && <div className={theme.errorBox}>{error}</div>}
        </form>

        <div className={`p-4 border-t shrink-0 flex gap-3 ${theme.header}`}>
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
            form="edit-trip-details-form"
            disabled={loading || !canEdit}
            className={action.primary}
          >
            {loading ? (
              "Saving..."
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faSave} />
                Save Details
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function WarehouseSelect({
  label,
  value,
  code,
  onChange,
  isDark,
  disabled,
  excludedCode,
}) {
  const options = WAREHOUSES.filter(
    (warehouse) => warehouse.code !== excludedCode,
  );

  return (
    <div
      className={`p-3 rounded-lg border ${
        isDark
          ? "bg-slate-950/50 border-slate-800"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <label
          className={`text-[10px] font-bold uppercase ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          {label}
        </label>
        {code && (
          <span
            className={`text-[10px] font-mono px-1.5 rounded ${
              isDark
                ? "bg-blue-500/20 text-blue-400"
                : "bg-blue-100 text-blue-700 border border-blue-200"
            }`}
          >
            {code}
          </span>
        )}
      </div>

      <select
        className={`w-full rounded-lg p-2 text-xs outline-none appearance-none cursor-pointer border disabled:opacity-60 ${
          isDark
            ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
            : "bg-white border-slate-300 text-slate-900 focus:border-blue-500"
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      >
        <option value="">Select warehouse...</option>
        {options.map((warehouse) => (
          <option key={warehouse.code} value={warehouse.name}>
            {warehouse.name}
          </option>
        ))}
      </select>
    </div>
  );
}
