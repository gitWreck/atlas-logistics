"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function TripScheduleNotificationToggle({
  checked,
  onChange,
  icon,
  theme,
  title,
  description,
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${theme.panelSurface}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4"
      />

      <div className="min-w-0">
        <div
          className={`text-sm font-semibold flex items-center gap-2 ${theme.title}`}
        >
          {icon ? <FontAwesomeIcon icon={icon} /> : null}
          {title}
        </div>

        <p className={`text-xs mt-1 ${theme.helperText}`}>{description}</p>
      </div>
    </label>
  );
}
