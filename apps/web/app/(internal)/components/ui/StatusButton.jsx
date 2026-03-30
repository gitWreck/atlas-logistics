"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleNotch,
  faCheck,
  faTimesCircle,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";
import { getButtonThemeClasses } from "@/app/utility/constant/theme";
import { getButtonActionClasses } from "@/app/utility/constant/action";

export default function StatusButton({
  status = "IDLE",
  onClick,
  disabled = false,

  // Content
  icon,
  label = "Submit",

  // Labels
  loadingLabel = "Processing...",
  successLabel = "Success!",
  errorLabel = "Failed",

  // Theme control
  variant = "blue", // blue | amber | emerald | red
  isDark = false,

  // Optional override
  className = "",
}) {
  const theme = getButtonThemeClasses(isDark);
  const action = getButtonActionClasses(isDark);

  const getConfig = () => {
    switch (status) {
      case "LOADING":
        return {
          color: action.loading,
          icon: faCircleNotch,
          spin: true,
          text: loadingLabel,
        };

      case "SUCCESS":
        return {
          color: action.success,
          icon: faCheck,
          spin: false,
          text: successLabel,
        };

      case "ERROR":
        return {
          color: action.error,
          icon: faTimesCircle,
          spin: false,
          text: errorLabel,
        };

      default:
        return {
          color: action.idle[variant] || action.idle.blue,
          icon: icon || faExclamationCircle,
          spin: false,
          text: label,
        };
    }
  };

  const config = getConfig();

  return (
    <button
      onClick={onClick}
      disabled={disabled || status === "LOADING" || status === "SUCCESS"}
      className={`${theme.base} ${config.color} ${className}`}
    >
      <FontAwesomeIcon icon={config.icon} spin={config.spin} />
      <span>{config.text}</span>
    </button>
  );
}
