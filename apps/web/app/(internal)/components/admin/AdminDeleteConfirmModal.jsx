"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTrash,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

export default function AdminDeleteConfirmModal({
  isOpen,
  onClose,
  title,
  entityLabel,
  description,
  onConfirm,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const theme = getModalThemeClasses(isDark);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setError("");
    onClose();
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || "Delete failed.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        className={`relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${theme.modal}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`px-5 py-4 border-b flex justify-between items-center ${theme.header}`}
        >
          <h3
            className={`font-bold text-sm uppercase flex items-center gap-2 text-red-500`}
          >
            <FontAwesomeIcon icon={faTrash} />
            {title}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className={theme.closeButton}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-300 text-xs flex gap-2 items-start">
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              className="mt-0.5 shrink-0"
            />
            <div>
              Permanently delete <strong>{entityLabel}</strong>?{" "}
              {description ||
                "This cannot be undone and is logged in Admin Logs."}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm border ${theme.secondaryButton}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
