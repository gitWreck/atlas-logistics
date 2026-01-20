import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faBan,
} from "@fortawesome/free-solid-svg-icons";
import { doc, updateDoc } from "firebase/firestore"; // Import Firestore functions
import { db, app as mainApp } from "@/apps/web/lib/firebase"; // Import your DB instance
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";

const functions = getFunctions(mainApp);
connectFunctionsEmulator(functions, "localhost", 5001);
const toggleUserAccount = httpsCallable(functions, "toggleUserAccount");

export default function DisableUserModal({
  isOpen,
  onClose,
  user,
  refreshUsers,
}) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;
  const isActive = user?.active !== false; // if `active` is false → disabled

  const handleToggle = async (activeStatus) => {
    if (!user) return;
    setLoading(true);

    try {
      await toggleUserAccount({ uid: user.id, active: activeStatus });

      // ✅ Refresh the user list
      if (refreshUsers) refreshUsers();

      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />
      <div className="relative bg-slate-900 border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              className="text-3xl"
            />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">
            {isActive ? "Disable Account?" : "Activate Account?"}
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            Are you sure you want to {isActive ? "disable" : "activate"}{" "}
            <span className="text-white font-semibold">{user?.email}</span>?
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleToggle(!isActive)}
              disabled={loading}
              className={`px-5 py-2.5 rounded-lg ${
                isActive
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-green-600 hover:bg-green-500"
              } text-white shadow-lg shadow-red-500/20 flex items-center gap-2 disabled:opacity-50`}
            >
              {loading ? (
                "Processing..."
              ) : isActive ? (
                <>
                  <FontAwesomeIcon icon={faBan} /> Disable User
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

// const handleDisable = async () => {
//   if (!user) return;
//   setLoading(true);

//   try {
//     const userRef = doc(db, "users", user.id);

//     // Perform the update directly inside the modal
//     await updateDoc(userRef, {
//       active: false,
//       disabledAt: new Date().toISOString(),
//     });

//     // Close modal after success
//     onClose();
//   } catch (error) {
//     console.error("Error disabling user:", error);
//     alert("Failed to disable user");
//   } finally {
//     setLoading(false);
//   }
// };
