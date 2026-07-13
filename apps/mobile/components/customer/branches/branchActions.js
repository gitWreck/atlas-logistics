import { Alert, Linking, Share } from "react-native";

function googleMapsUrl(branch, directions = false) {
  const { latitude, longitude } = branch.coordinate;
  if (directions) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

async function openUrl(url, fallbackMessage) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert("Unable to open", fallbackMessage);
  }
}

export function getDirections(branch) {
  return openUrl(googleMapsUrl(branch, true), "Google Maps could not be opened on this device.");
}

export function openInGoogleMaps(branch) {
  return openUrl(googleMapsUrl(branch), "Google Maps could not be opened on this device.");
}

export function callBranch(branch) {
  return openUrl(`tel:${branch.phoneUri}`, "Calling is not available on this device.");
}

export function callPhone(phoneUri) {
  return openUrl(`tel:${phoneUri}`, "Calling is not available on this device.");
}

export function shareBranch(branch) {
  const { latitude, longitude } = branch.coordinate;
  return Share.share({
    title: branch.name,
    message: `${branch.name}\n${branch.location}\nhttps://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  });
}
