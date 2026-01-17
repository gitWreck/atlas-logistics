import { signOut } from "firebase/auth";

export function calculateProgress(status) {
  switch (status) {
    case "CREATED":
      return 10;
    case "RECEIVED":
      return 25;
    case "ASSIGNED":
      return 40;
    case "LOADED":
      return 60;
    case "IN_TRANSIT":
      return 75;
    case "OUT_FOR_DELIVERY":
      return 90;
    case "DELIVERED":
      return 100;
    default:
      return 0;
  }
}

export function formatFirestoreDate(timestamp) {
  if (!timestamp?._seconds) return "";

  return new Date(timestamp._seconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --------------------------

export const handleLogout = async (auth, router) => {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Logout error (likely emulator stale token):", error);
  } finally {
    localStorage.removeItem("atlas_user"); // optional
    router.push("/login");
  }
};

// src/app/utility/uiHelpers.js

export const runAction = async (setStatus, apiPromise, onSuccess) => {
  setStatus("LOADING");
  try {
    const result = await apiPromise();
    setStatus("SUCCESS");
    if (onSuccess) onSuccess(result);
  } catch (e) {
    console.error(e);
    setStatus("ERROR");
    // Optional: Use a Toast here instead of alert
    alert(e.message || "Operation failed");
  } finally {
    // Reset to IDLE after 2 seconds so the user can try again
    setTimeout(() => setStatus("IDLE"), 2000);
  }
};
