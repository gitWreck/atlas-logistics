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

export function getVisualProgress(status) {
  switch (status) {
    case "RECEIVED":
      return 0;
    case "IN_TRANSIT":
      return 33;
    case "OUT_FOR_DELIVERY":
      return 66;
    case "DELIVERED":
      return 100;
    default:
      return 0;
  }
}

export function formatFirestoreDate(value) {
  if (!value) return "";

  let date;

  // 1. Handle actual Firestore Timestamp object (Best Practice)
  if (typeof value.toDate === "function") {
    date = value.toDate();
  }
  // 2. Handle object with 'seconds' (Web SDK / Client side)
  else if (value.seconds) {
    date = new Date(value.seconds * 1000);
  }
  // 3. Handle object with '_seconds' (Node.js / Admin SDK)
  else if (value._seconds) {
    date = new Date(value._seconds * 1000);
  }
  // 4. Handle String, Number, or Date Object
  else {
    date = new Date(value);
  }

  // Final validation
  if (isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
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
