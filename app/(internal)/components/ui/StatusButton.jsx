import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleNotch,
  faCheck,
  faTimesCircle,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";

export default function StatusButton({
  status = "IDLE", // IDLE, LOADING, SUCCESS, ERROR
  onClick,
  disabled = false,

  // Default (IDLE) Config
  icon,
  label = "Submit",

  // Optional Custom Labels for states
  loadingLabel = "Processing...",
  successLabel = "Success!",
  errorLabel = "Failed",

  // Optional Styling overrides
  className = "",
  idleColor = "bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30",
}) {
  // Helper to determine look & feel based on status
  const getConfig = () => {
    switch (status) {
      case "LOADING":
        return {
          color:
            "bg-blue-600/10 text-blue-400 border-blue-500/30 cursor-wait opacity-80",
          icon: faCircleNotch,
          spin: true,
          text: loadingLabel,
        };
      case "SUCCESS":
        return {
          color:
            "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20",
          icon: faCheck,
          spin: false,
          text: successLabel,
        };
      case "ERROR":
        return {
          color: "bg-red-500 text-white border-red-600",
          icon: faTimesCircle,
          spin: false,
          text: errorLabel,
        };
      default: // IDLE
        return {
          color: idleColor,
          icon: icon || faExclamationCircle, // Fallback icon
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
      className={`
        flex-1 py-2 rounded text-xs font-bold transition-all duration-300 
        flex items-center justify-center gap-2 border 
        disabled:opacity-50 disabled:cursor-not-allowed
        ${config.color} 
        ${className}
      `}
    >
      <FontAwesomeIcon icon={config.icon} spin={config.spin} />
      <span>{config.text}</span>
    </button>
  );
}
