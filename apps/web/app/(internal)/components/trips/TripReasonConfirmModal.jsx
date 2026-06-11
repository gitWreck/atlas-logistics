"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

export default function TripReasonConfirmModal({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "amber",
  entityLabel,
  onConfirm,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const theme = getModalThemeClasses(isDark);

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err?.message || "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  const confirmClass =
    confirmVariant === "red"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-amber-600 hover:bg-amber-500";

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
          <h3 className={`font-bold text-sm uppercase ${theme.title}`}>
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
          <p className={`text-sm ${theme.label}`}>
            {description || (
              <>
                Apply this action to <strong>{entityLabel}</strong>. Shipments
                and audit history are preserved.
              </>
            )}
          </p>

          <div>
            <label className={`block text-xs font-bold uppercase mb-2 ${theme.label}`}>
              Reason
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this action is being taken..."
              className={`w-full p-3 rounded-lg text-sm min-h-[96px] outline-none focus:ring-1 focus:ring-amber-500 border ${theme.input}`}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm border ${theme.secondaryButton}`}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !reason.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${confirmClass}`}
            >
              {loading ? "Saving..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
