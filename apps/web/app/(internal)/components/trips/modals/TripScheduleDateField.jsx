"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatTripDisplayDate, getDayLabel } from "../tripHelpers";

export default function TripScheduleDateField({
  label,
  icon,
  value,
  onChange,
  theme,
  type = "datetime-local",
  disabled = false,
}) {
  const dayLabel = getDayLabel(value);

  return (
    <div className="space-y-2">
      <label
        className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${theme.label}`}
      >
        <FontAwesomeIcon icon={icon} className="text-[10px]" />
        {label}
      </label>

      <div className="space-y-2">
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${theme.input}`}
        />

        <div
          className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-3 ${theme.input}`}
        >
          <span className={`font-semibold ${theme.title}`}>{dayLabel}</span>
          <span className={theme.helperText}>
            {formatTripDisplayDate(value)}
          </span>
        </div>
      </div>
    </div>
  );
}
