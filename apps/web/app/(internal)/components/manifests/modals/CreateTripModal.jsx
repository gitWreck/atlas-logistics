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

import RouteSelector from "../CreateTripModal/RouteSelector";
import ScheduleSection from "../CreateTripModal/ScheduleSection";
import VehicleDetails from "../CreateTripModal/VehicleDetails";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

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
  tripType: "HUB TRANSFER",
};

export default function CreateTripModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_FORM_STATE);
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  const handleWarehouseChange = (type, value) => {
    const selected = WAREHOUSES.find((warehouse) => warehouse.name === value);
    const code = selected ? selected.code : "";

    setFormData((prev) => ({
      ...prev,
      [type]: value,
      [`${type}Code`]: code,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.tripType === "HUB TRANSFER" && !formData.destinationCode) {
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
        destinationCity: formData.destination || formData.origin,
        destinationCode: formData.destinationCode || formData.originCode,
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to create trip.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-full sm:h-auto sm:max-h-[90vh] flex flex-col sm:rounded-xl border ${theme.modal}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex justify-between items-center shrink-0 ${theme.header}`}
        >
          <h3
            className={`font-bold flex items-center gap-2 text-lg ${theme.title}`}
          >
            <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
            Create New Trip
          </h3>

          <button
            type="button"
            onClick={onClose}
            className={`transition-colors p-2 -mr-2 ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          <form
            id="create-trip-form"
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Trip type toggle */}
            <div className={`p-1 rounded-xl border flex ${theme.panelSurface}`}>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    tripType: "HUB TRANSFER",
                  }))
                }
                className={
                  formData.tripType === "HUB TRANSFER"
                    ? action.primaryInlineCompact
                    : `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${theme.toggleIdle}`
                }
              >
                <FontAwesomeIcon icon={faRoute} />
                Warehouse Transfer
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    tripType: "LOCAL",
                  }))
                }
                className={
                  formData.tripType === "LOCAL"
                    ? action.warningInline
                    : `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${theme.toggleIdle}`
                }
              >
                <FontAwesomeIcon icon={faTruckPickup} />
                Local Pickup Route
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

            {error && <div className={theme.errorBox}>{error}</div>}
          </form>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t shrink-0 flex gap-3 ${theme.header}`}>
          <button
            type="button"
            onClick={onClose}
            className={theme.secondaryButton}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="create-trip-form"
            disabled={loading}
            className={action.primary}
          >
            {loading ? "Creating..." : "Create Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
