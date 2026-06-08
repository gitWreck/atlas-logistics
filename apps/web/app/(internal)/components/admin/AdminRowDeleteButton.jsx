"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import AdminDeleteConfirmModal from "./AdminDeleteConfirmModal";
import { useAuth } from "@/app/context/AuthContext";
import { canDeleteShipmentsAndTrips } from "@/app/utility/deletePermissions";

export default function AdminRowDeleteButton({
  profile,
  entityLabel,
  title = "Delete",
  description,
  onDelete,
  onSuccess,
  isDark = false,
  buttonClassName = "",
}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!canDeleteShipmentsAndTrips(profile, user)) return null;

  return (
    <>
      <button
        type="button"
        title={title}
        aria-label={title}
        className={`p-2 rounded-full transition-colors text-red-500/80 hover:text-red-400 hover:bg-red-500/10 ${buttonClassName}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <FontAwesomeIcon icon={faTrash} className="text-sm" />
      </button>

      <AdminDeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        entityLabel={entityLabel}
        description={description}
        isDark={isDark}
        onConfirm={async () => {
          await onDelete();
          onSuccess?.();
        }}
      />
    </>
  );
}
