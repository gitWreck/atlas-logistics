"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom"; // 1. Import this
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTimesCircle,
  faTriangleExclamation,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";

const AlertContext = createContext();

export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    type: "success", // success, error, warning, info, confirm
    title: "",
    message: "",
    onConfirm: null, // Only for confirmation
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Styles configuration based on type
  const config = {
    success: {
      icon: faCheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      button: "bg-emerald-600 hover:bg-emerald-500",
    },
    error: {
      icon: faTimesCircle,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      button: "bg-rose-600 hover:bg-rose-500",
    },
    warning: {
      icon: faTriangleExclamation,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      button: "bg-amber-600 hover:bg-amber-500",
    },
    info: {
      icon: faInfoCircle,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      button: "bg-blue-600 hover:bg-blue-500",
    },
    confirm: {
      icon: faInfoCircle, // Or a question mark
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      button: "bg-violet-600 hover:bg-violet-500",
    },
  };

  const activeConfig = config[alertState.type] || config.info;

  // --- ACTIONS ---

  const showAlert = (type, title, message) => {
    setAlertState({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: null,
    });
  };

  const showConfirm = (title, message, onConfirmAction) => {
    setAlertState({
      isOpen: true,
      type: "confirm",
      title,
      message,
      onConfirm: onConfirmAction,
    });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (alertState.onConfirm) alertState.onConfirm();
    closeAlert();
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, closeAlert }}>
      {children}

      {/* --- THE MODAL UI --- */}
      {mounted &&
        alertState.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
              onClick={alertState.type === "confirm" ? null : closeAlert}
            />

            <div className="relative bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 text-center">
                {/* Icon Circle */}
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${activeConfig.bg} ${activeConfig.color} ${activeConfig.border}`}
                >
                  <FontAwesomeIcon icon={activeConfig.icon} size="2x" />
                </div>

                {/* Text */}
                <h4 className="text-xl font-bold text-white mb-2">
                  {alertState.title}
                </h4>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  {alertState.message}
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                  {alertState.type === "confirm" ? (
                    <>
                      <button
                        onClick={closeAlert}
                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirm}
                        className={`flex-1 py-3 rounded-xl text-white font-bold transition-colors shadow-lg ${activeConfig.button}`}
                      >
                        Confirm
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={closeAlert}
                      className={`w-full py-3 rounded-xl text-white font-bold transition-colors shadow-lg ${activeConfig.button}`}
                    >
                      Okay
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body, // <--- This moves it to the end of the DOM
        )}
    </AlertContext.Provider>
  );
};
