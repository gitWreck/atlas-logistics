"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faBan,
} from "@fortawesome/free-solid-svg-icons";
import { toggleUserStatus } from "@/app/utility/FirebaseFunctions";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

export default function DisableUserModal({
  isOpen,
  onClose,
  user,
  refreshUsers,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  if (!isOpen || !user) return null;

  const isActive = user.status === "active";

  const handleToggle = async () => {
    setLoading(true);

    try {
      await toggleUserStatus({
        uid: user.id || user.uid,
        shouldDisable: isActive,
      });

      refreshUsers?.();
      onClose();
    } catch (error) {
      console.error("Failed to toggle user:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 ${theme.overlay}`}
        onClick={!loading ? onClose : undefined}
      />

      <div
        className={`relative w-full max-w-md rounded-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${theme.modal} ${isActive ? theme.dangerModalBorder : theme.successModalBorder}`}
      >
        <div className="p-6 text-center">
          <div
            className={isActive ? theme.warningIconWrap : theme.successIconWrap}
          >
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              className="text-3xl"
            />
          </div>

          <h3 className={`text-xl font-bold mb-2 ${theme.title}`}>
            {isActive ? "Disable Account?" : "Activate Account?"}
          </h3>

          <p className={`text-sm mb-6 ${theme.bodyText}`}>
            Are you sure you want to {isActive ? "disable" : "activate"}{" "}
            <span className={`font-semibold ${theme.title}`}>{user.email}</span>
            ?
          </p>

          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={theme.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleToggle}
              disabled={loading}
              className={isActive ? action.danger : action.success}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isActive ? (
                <>
                  <FontAwesomeIcon icon={faBan} />
                  <span>Disable User</span>
                </>
              ) : (
                <span>Activate User</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
