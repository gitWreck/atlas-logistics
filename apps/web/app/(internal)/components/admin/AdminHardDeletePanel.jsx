"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../ui/StatusButton";
import { useAlert } from "@/app/context/AlertContext";
import { runAction } from "@/app/utility/utilities";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";

function isAdminStaff(profile) {
  const role = String(profile?.role || "").toLowerCase();
  return role === "admin" || role === "manager";
}

export default function AdminHardDeletePanel({
  title,
  description,
  entityLabel,
  reasonPlaceholder = "Reason for deletion (required, logged in Admin Logs)...",
  confirmMessage,
  onDelete,
  onSuccess,
  isDark = false,
  profile,
}) {
  const { showAlert, showConfirm } = useAlert();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("IDLE");
  const theme = getWidgetThemeClasses(isDark);

  if (!isAdminStaff(profile)) return null;

  const handleDelete = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      return showAlert(
        "warning",
        "Reason Required",
        "Enter a reason before deleting. It will be stored in Admin Logs.",
      );
    }

    showConfirm(
      "Permanently Delete?",
      confirmMessage ||
        `This permanently deletes ${entityLabel}. The action is recorded in Admin Logs and cannot be undone.`,
      () => {
        runAction(
          setStatus,
          () => onDelete({ reason: trimmedReason }),
          () => {
            setReason("");
            onSuccess?.();
          },
        );
      },
    );
  };

  return (
    <div
      className={`border rounded-xl p-5 shadow-lg ${theme.container} border-red-500/30`}
    >
      <h3
        className={`text-sm font-bold mb-3 flex items-center gap-2 text-red-500`}
      >
        <FontAwesomeIcon icon={faTrash} />
        {title}
      </h3>

      <p className={`text-xs mb-4 ${theme.bodyText}`}>{description}</p>

      <div
        className={`mb-4 flex items-start gap-2 text-[10px] p-2 rounded ${theme.noteBox}`}
      >
        <FontAwesomeIcon
          icon={faExclamationTriangle}
          className="text-red-500 mt-0.5 shrink-0"
        />
        <span className="text-red-400">
          Hard delete permanently removes <strong>{entityLabel}</strong>. This
          action is recorded in Admin Logs and cannot be undone.
        </span>
      </div>

      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={reasonPlaceholder}
        className={`w-full border rounded-lg p-3 text-sm outline-none focus:border-red-500 resize-none h-24 mb-4 ${theme.textarea}`}
      />

      <StatusButton
        status={status}
        label={`Delete ${entityLabel}`}
        disabled={!reason.trim() || status === "LOADING"}
        variant="red"
        isDark={isDark}
        onClick={handleDelete}
      />
    </div>
  );
}
