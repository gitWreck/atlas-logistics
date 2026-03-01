import GetLocation from "react-native-get-location";

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
    const loc = await GetLocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    if (!loc) return null;
    return { lat: loc.latitude, lng: loc.longitude };
  } catch (error) {
    console.log("Location error:", error);
    return null;
  }
};
