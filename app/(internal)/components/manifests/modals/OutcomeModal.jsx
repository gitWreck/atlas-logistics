import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

export default function OutcomeModal({
  isOpen,
  onClose,
  type = "SUCCESS", // or "ERROR"
  title,
  message,
}) {
  if (!isOpen) return null;

  const isSuccess = type === "SUCCESS";

  // Configuration for Colors/Icons
  const config = isSuccess
    ? {
        borderColor: "border-emerald-500/50",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-400",
        titleColor: "text-white",
        icon: faCheckCircle,
        button:
          "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20",
      }
    : {
        borderColor: "border-red-500/50",
        bgColor: "bg-red-500/10",
        textColor: "text-red-400",
        titleColor: "text-white",
        icon: faTriangleExclamation,
        button: "bg-red-600 hover:bg-red-500 text-white shadow-red-900/20",
      };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`bg-slate-900 border ${config.borderColor} rounded-xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}
      >
        {/* Header Icon Area */}
        <div
          className={`p-6 flex flex-col items-center justify-center gap-3 ${config.bgColor} border-b ${config.borderColor}`}
        >
          <FontAwesomeIcon
            icon={config.icon}
            className={`text-4xl ${config.textColor}`}
          />
          <h3 className={`text-xl font-bold ${config.titleColor} text-center`}>
            {title || (isSuccess ? "Success!" : "Error")}
          </h3>
        </div>

        {/* Message Body */}
        <div className="p-6 space-y-4">
          <p className="text-slate-300 text-center text-sm leading-relaxed">
            {message}
          </p>

          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all ${config.button}`}
          >
            {isSuccess ? "Okay, Great" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
