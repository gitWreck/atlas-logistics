import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faBan,
} from "@fortawesome/free-solid-svg-icons";
import { toggleUserStatus } from "@/app/utility/FirebaseFunctions";

export default function DisableUserModal({
  isOpen,
  onClose,
  user,
  refreshUsers,
  isDark = false, // Added isDark prop
}) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;
  const isActive = user.status === "active";

  const handleToggle = async () => {
    setLoading(true);

    try {
      const shouldDisable = isActive;
      await toggleUserStatus({
        uid: user.id || user.uid,
        shouldDisable,
      });

      if (refreshUsers) refreshUsers();

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
        className={`absolute inset-0 backdrop-blur-sm ${
          isDark ? "bg-slate-950/80" : "bg-slate-500/40"
        }`}
        onClick={!loading ? onClose : undefined}
      />
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${
          isDark
            ? "bg-slate-900 border-red-500/30"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="p-6 text-center">
          {/* Icon */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isActive
                ? "bg-red-500/10 text-red-500"
                : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              className="text-3xl"
            />
          </div>

          {/* Title */}
          <h3
            className={`text-xl font-bold mb-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {isActive ? "Disable Account?" : "Activate Account?"}
          </h3>

          {/* Body Text */}
          <p
            className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            Are you sure you want to {isActive ? "disable" : "activate"}{" "}
            <span
              className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {user.email}
            </span>
            ?
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              disabled={loading}
              className={`flex-1 px-5 py-2.5 rounded-lg border disabled:opacity-50 transition-colors font-medium text-sm ${
                isDark
                  ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`flex-1 px-5 py-2.5 rounded-lg text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all font-medium text-sm ${
                isActive
                  ? "bg-red-600 hover:bg-red-500 shadow-red-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isActive ? (
                <>
                  <FontAwesomeIcon icon={faBan} /> <span>Disable User</span>
                </>
              ) : (
                "Activate User"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
