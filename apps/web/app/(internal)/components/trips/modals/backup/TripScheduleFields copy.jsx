"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faClock,
  faTruckRampBox,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

export default function TripScheduleFields({
  formData,
  setFormData,
  isDark = false,
  errors = {},
  showLoadingWindow = false,
}) {
  const theme = getModalThemeClasses(isDark);

  const handleFieldChange = (field, fieldValue) => {
    setFormData((prev) => ({
      ...prev,
      [field]: fieldValue,
    }));
  };

  return (
    <div className={`p-3 rounded-xl border space-y-4 ${theme.panelSurface}`}>
      <div>
        <p className="text-[10px] font-bold uppercase flex items-center gap-2 text-blue-500">
          <FontAwesomeIcon icon={faCalendarDays} />
          Trip Schedule
        </p>
        <p className={`text-xs mt-1 ${theme.helperText}`}>
          Set the planned departure and estimated arrival for this trip.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScheduleInput
          label="Planned Departure"
          icon={faClock}
          type="datetime-local"
          value={formData.plannedDeparture || ""}
          onChange={(e) =>
            handleFieldChange("plannedDeparture", e.target.value)
          }
          theme={theme}
          error={errors.plannedDeparture}
          required
        />

        <ScheduleInput
          label="Estimated Arrival"
          icon={faCalendarDays}
          type="datetime-local"
          value={formData.estimatedArrival || ""}
          onChange={(e) =>
            handleFieldChange("estimatedArrival", e.target.value)
          }
          theme={theme}
          error={errors.estimatedArrival}
          required
        />
      </div>

      {showLoadingWindow && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScheduleInput
            label="Planned Loading Start"
            icon={faTruckRampBox}
            type="datetime-local"
            value={formData.plannedLoadingStart || ""}
            onChange={(e) =>
              handleFieldChange("plannedLoadingStart", e.target.value)
            }
            theme={theme}
            error={errors.plannedLoadingStart}
          />

          <ScheduleInput
            label="Planned Loading End"
            icon={faTruckRampBox}
            type="datetime-local"
            value={formData.plannedLoadingEnd || ""}
            onChange={(e) =>
              handleFieldChange("plannedLoadingEnd", e.target.value)
            }
            theme={theme}
            error={errors.plannedLoadingEnd}
          />
        </div>
      )}
    </div>
  );
}

function ScheduleInput({
  label,
  icon,
  theme,
  error,
  required = false,
  ...props
}) {
  return (
    <div className="space-y-1">
      <label
        className={`text-[10px] font-bold uppercase flex items-center gap-2 ${theme.label}`}
      >
        <FontAwesomeIcon icon={icon} className="text-[9px]" />
        {label}
      </label>

      <input
        {...props}
        required={required}
        className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme.input} ${
          error ? "border-red-500" : ""
        }`}
      />

      {error ? <p className={theme.errorBox}>{error}</p> : null}
    </div>
  );
}
