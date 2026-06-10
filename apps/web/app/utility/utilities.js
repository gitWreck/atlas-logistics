import { signOut } from "firebase/auth";

export function calculateProgress(status) {
  switch (status) {
    case "CREATED":
    case "PENDING_PICKUP": // 1. Initial State (Walk-in or Home Request)
      return 10;
    case "PICKED_UP": // 2. Driver collected it, heading to Hub
      return 15;
    case "RECEIVED": // 3. Arrived at the Origin Hub
      return 25;
    case "ASSIGNED":
      return 30;
    case "LOADING":
      return 40;
    case "PARTIALLY_LOADED":
      return 55;
    case "LOADED":
      return 60;
    case "PARTIALLY_IN_TRANSIT":
      return 68;
    case "IN_TRANSIT":
      return 75;
    case "PARTIALLY_IN_TRANSIT":
      return 72;
    case "PARTIALLY_ARRIVED":
      return 78;
    case "ARRIVED":
      return 80;
    case "PARTIALLY_AVAILABLE_FOR_DELIVERY":
      return 82;
    case "AVAILABLE_FOR_DELIVERY":
      return 84;
    case "READY_FOR_DELIVERY":
      return 85;
    case "OUT_FOR_DELIVERY":
      return 90;
    case "PARTIALLY_DELIVERED":
      return 83;
    case "DELIVERED":
      return 99;
    case "COMPLETED":
      return 100;
    case "CANCELLED":
    case "DELAYED":
      // Optional: You can handle delayed/cancelled here if you want the bar to freeze
      // where it was, but normally your UI handles the color change based on the status string.
      return 0;
    default:
      return 0;
  }
}

export function getVisualProgress(status) {
  switch (status) {
    case "RECEIVED":
    case "RECEIVED_AT_DIVISORIA":
    case "PENDING_PICKUP":
    case "PICKED_UP":
      return 0;
    case "IN_TRANSIT":
    case "PARTIALLY_IN_TRANSIT":
    case "LOADED":
      return 25;
    case "ARRIVED":
    case "PARTIALLY_ARRIVED":
    case "AVAILABLE_FOR_DELIVERY":
    case "PARTIALLY_AVAILABLE_FOR_DELIVERY":
    case "READY_FOR_DELIVERY":
    case "AVAILABLE_AT_WAREHOUSE":
      return 50;
    case "OUT_FOR_DELIVERY":
    case "PARTIALLY_DELIVERED":
      return 75;
    case "DELIVERED":
    case "COMPLETED":
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

// src/utils/formatters.js
export const normalizePhoneNumber = (input) => {
  if (!input) return "";

  // 1. Remove all non-numeric characters (spaces, dashes, parentheses)
  //    Example: "(0917) 123-4567" -> "09171234567"
  let cleaned = input.replace(/\D/g, "");

  // 2. Handle Philippines specific cases
  // Case A: Starts with "09" (Standard local) -> Replace "0" with "63"
  if (cleaned.startsWith("09") && cleaned.length === 11) {
    cleaned = "63" + cleaned.substring(1);
  }
  // Case B: Starts with "9" (Short local) -> Add "63"
  else if (cleaned.startsWith("9") && cleaned.length === 10) {
    cleaned = "63" + cleaned;
  }

  // 3. Check for valid length (PH numbers are 12 digits including country code 63)
  if (cleaned.length !== 12 || !cleaned.startsWith("63")) {
    // Return original or null if you want strict validation failure
    return input;
  }

  // 4. Return E.164 Standard (with +)
  return `${cleaned}`;
};

// Optional: A display formatter for reading (User friendly)
export const displayPhoneNumber = (e164Number) => {
  if (!e164Number) return "";
  // Turns +639171234567 -> 0917 123 4567
  const cleaned = e164Number.replace("+63", "0");
  return cleaned.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3");
};

// -----------------------------------------
export function formatCallableError(err, fallback = "Operation failed.") {
  const code = err?.code || "";
  const message = err?.message || "";

  switch (code) {
    case "functions/not-found":
      return "This service is unavailable. Contact an admin or retry after functions are deployed.";
    case "functions/internal":
      return "Something went wrong on the server. Check Functions logs or try again.";
    case "functions/unauthenticated":
      return "You must be logged in to perform this action.";
    case "functions/permission-denied":
      return "You do not have permission to perform this action.";
    case "functions/failed-precondition":
      return message || "This action cannot be completed in the current state.";
    case "functions/invalid-argument":
      return message || "Invalid request. Please refresh and try again.";
    default:
      if (message && message.toLowerCase() !== "internal") {
        return message;
      }
      return fallback;
  }
}

export function updatedBy(profile) {
  const object = {
    usercode: profile?.userCode || "Unknown User",
    username: profile?.name || "Unknown Name",
    role: profile?.role || "Unknown Role",
  };

  return object;
}
