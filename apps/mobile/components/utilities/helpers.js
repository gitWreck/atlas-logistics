import * as Location from "expo-location";

// Safe time formatter for Firebase timestamps
export const getFormattedTime = (timestamp) => {
  if (!timestamp) return "Just now";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    // Returns format like "Oct 24, 10:30 AM"
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "Just now";
  }
};

export const getCurrentLocationSafe = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    if (!loc) return null;
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch (error) {
    console.log("Location error:", error);
    return null;
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

export function updatedBy(profile) {
  const object = {
    usercode: profile?.userCode || "Unknown User",
    username: profile?.name || "Unknown Name",
    role: profile?.role || "Unknown Role",
  };

  return object;
}
