"use client";

import React, { useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faTruckRampBox,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PAIRING_MAP = {
  2: 4, // Tuesday -> Thursday
  3: 5, // Wednesday -> Friday
  4: 6, // Thursday -> Saturday
  6: 1, // Saturday -> Monday
};

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDateForInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseInputDate(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatDisplayDate(value) {
  const date = typeof value === "string" ? parseInputDate(value) : value;
  if (!date) return "No date selected";

  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getNextDateForWeekday(fromDate, targetDay) {
  const base = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  );

  while (base.getDay() !== targetDay) {
    base.setDate(base.getDate() + 1);
  }

  return base;
}

function getDefaultDepartureDate(baseDate = new Date()) {
  const today = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  );

  const allowedDays = [2, 3, 4, 6];

  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(today);
    candidate.setDate(today.getDate() + offset);

    if (allowedDays.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return today;
}

function getPairedArrivalDate(departureValue) {
  const departureDate = parseInputDate(departureValue);
  if (!departureDate) return null;

  const departureDay = departureDate.getDay();
  const arrivalDay = PAIRING_MAP[departureDay];

  if (arrivalDay === undefined) return null;

  return getNextDateForWeekday(departureDate, arrivalDay);
}

export default function TripScheduleFields({
  formData,
  setFormData,
  isDark = false,
  errors = {},
  showLoadingWindow = false,
}) {
  const theme = getModalThemeClasses(isDark);

  useEffect(() => {
    const hasDeparture = Boolean(formData.plannedDeparture);
    const hasArrival = Boolean(formData.estimatedArrival);

    if (hasDeparture) return;

    const defaultDeparture = getDefaultDepartureDate(startOfToday());
    const defaultDepartureValue = formatDateForInput(defaultDeparture);
    const defaultArrival = getPairedArrivalDate(defaultDepartureValue);
    const defaultArrivalValue = formatDateForInput(defaultArrival);

    setFormData((prev) => ({
      ...prev,
      plannedDeparture: prev.plannedDeparture || defaultDepartureValue,
      estimatedArrival: prev.estimatedArrival || defaultArrivalValue,
    }));
  }, [formData.plannedDeparture, formData.estimatedArrival, setFormData]);

  const departureDate = useMemo(
    () => parseInputDate(formData.plannedDeparture),
    [formData.plannedDeparture],
  );

  const departureDay = departureDate?.getDay();
  const pairedArrivalDate = useMemo(
    () => getPairedArrivalDate(formData.plannedDeparture),
    [formData.plannedDeparture],
  );

  const isPairableDeparture = departureDay in PAIRING_MAP;

  const pairingHelper = useMemo(() => {
    if (!departureDate) return "Select a departure date.";

    if (!isPairableDeparture) {
      return "Selected departure is outside the standard trip pairing days.";
    }

    return `${DAY_LABELS[departureDay]} → ${DAY_LABELS[PAIRING_MAP[departureDay]]}`;
  }, [departureDate, departureDay, isPairableDeparture]);

  const handleDepartureChange = (value) => {
    const nextArrival = getPairedArrivalDate(value);

    setFormData((prev) => ({
      ...prev,
      plannedDeparture: value,
      estimatedArrival: nextArrival
        ? formatDateForInput(nextArrival)
        : prev.estimatedArrival,
    }));
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
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
          Select a departure date and the arrival will follow the standard trip
          pairing when applicable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ScheduleDateField
          label="Planned Departure"
          icon={faCalendarDays}
          value={formData.plannedDeparture || ""}
          onChange={handleDepartureChange}
          theme={theme}
          error={errors.plannedDeparture}
          // helper={pairingHelper}
          required
        />

        <ScheduleDateField
          label="Estimated Arrival"
          icon={faCalendarDays}
          value={formData.estimatedArrival || ""}
          onChange={(value) => handleFieldChange("estimatedArrival", value)}
          theme={theme}
          error={errors.estimatedArrival}
          // helper={
          //   pairedArrivalDate
          //     ? `Paired arrival: ${formatDisplayDate(pairedArrivalDate)}`
          //     : "You may adjust the arrival date manually."
          // }
          required
        />

        {/* {showLoadingWindow && (
          <ScheduleDateField
            label="Planned Loading Start"
            icon={faTruckRampBox}
            value={formData.plannedLoadingStart || ""}
            onChange={(value) =>
              handleFieldChange("plannedLoadingStart", value)
            }
            theme={theme}
            error={errors.plannedLoadingStart}
          />
        )} */}
      </div>
    </div>
  );
}

function ScheduleDateField({
  label,
  icon,
  value,
  onChange,
  theme,
  error,
  helper,
  required = false,
}) {
  return (
    <div className="space-y-1.5">
      <label
        className={`text-[10px] font-bold uppercase flex items-center gap-2 ${theme.label}`}
      >
        <FontAwesomeIcon icon={icon} className="text-[9px]" />
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme.input} ${
          error ? "border-red-500" : ""
        }`}
      />

      <div
        className={`w-full border rounded-lg p-3 text-sm ${theme.input} ${
          error ? "border-red-500" : ""
        }`}
      >
        <div className="font-semibold">{formatDisplayDate(value)}</div>

        {helper ? (
          <div className={`text-[11px] mt-1 ${theme.helperText}`}>{helper}</div>
        ) : null}
      </div>

      {error ? <p className={theme.errorBox}>{error}</p> : null}
    </div>
  );
}
