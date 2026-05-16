export function getScannerErrorGuidance(message, state, trip) {
  if (!message) return "";

  const text = String(message).toLowerCase();
  const currentTripStatus = String(trip?.status || "").toUpperCase();

  if (
    text.includes("cannot unload") ||
    text.includes("marked as arrived before unloading")
  ) {
    if (currentTripStatus === "CREATED") {
      return "Try marking the trip as LOADED, then move it to IN_TRANSIT and ARRIVED before unloading.";
    }
    if (currentTripStatus === "LOADED") {
      return "Try dispatching the trip to IN_TRANSIT, then mark it ARRIVED when it reaches the warehouse.";
    }
    if (currentTripStatus === "IN_TRANSIT") {
      return "Use Mark as Arrived in this modal, then continue unloading.";
    }

    return "Unload scans are only available after the trip has arrived. Update the trip status, then try again.";
  }

  if (text.includes("manifest") && text.includes("locked")) {
    return "Unlock the manifest first, then scan again. If the trip is still moving, mark it ARRIVED before unloading.";
  }

  if (text.includes("trip already closed") || text.includes("completed/inactive")) {
    return "Choose an active trip or reopen the trip before making scanner changes.";
  }

  if (text.includes("no available delivery trips")) {
    return "Create or activate a DELIVERY trip, then refresh reconciliation.";
  }

  if (text.includes("select a delivery trip")) {
    return "Pick a delivery trip from the dropdown before assigning the handoff.";
  }

  if (text.includes("add remarks")) {
    return "Add a short reason for each missing shipment before completing the handoff.";
  }

  if (text.includes("not a delivery trip")) {
    return "Select a trip with trip type DELIVERY for the handoff.";
  }

  if (text.includes("source trip and delivery trip must be different")) {
    return "Choose a different delivery trip than the one you just unloaded.";
  }

  if (text.includes("no manifest") || text.includes("manifest not found")) {
    return "Lock or regenerate the source trip manifest, then review the handoff again.";
  }

  if (text.includes("label not found")) {
    return "Check that the label matches a shipment ID, package ID, or tracking number in the system.";
  }

  if (text.includes("scan or enter a label")) {
    return "Scan a barcode/QR code or type the label into Manual Entry.";
  }

  if (text.includes("choose load or unload")) {
    return "Select Load or Unload before scanning the label.";
  }

  if (text.includes("no trip selected")) {
    return "Close this modal, open a trip, then start the scanner from that trip.";
  }

  if (text.includes("package data is missing")) {
    return "Refresh the trip manifest and confirm this label is saved on the shipment package.";
  }

  if (text.includes("item is loaded")) {
    return "Scan a package with remaining load quantity, or switch to Unload if you are receiving it back.";
  }

  if (text.includes("no quantity is available")) {
    return "Confirm the package has loaded quantity before unloading, or choose another scan status/package.";
  }

  if (text.includes("quantity greater than zero")) {
    return "Enter at least 1 item to process before confirming.";
  }

  if (text.includes("shipment not assigned") || text.includes("belongs to another trip")) {
    return "Assign the shipment to this trip first, then scan it again.";
  }

  if (text.includes("trip shipment record not found")) {
    return "Assign or refresh the shipment on this trip so the manifest record exists.";
  }

  if (text.includes("camera access denied")) {
    return "Allow camera access in the browser, or use Manual Entry.";
  }

  if (text.includes("barcodedetector is not supported")) {
    return "Switch the scanner to HTML5 QR Code, or use Manual Entry.";
  }

  if (text.includes("html5 scanner could not start")) {
    return "Switch back to BarcodeDetector, allow camera access, or use Manual Entry.";
  }

  if (text.includes("failed to process scanned code")) {
    return "Try scanning again with the label centered, or enter the label manually.";
  }

  if (text.includes("authentication") || text.includes("unauthorized")) {
    return "Sign in again, then reopen the scanner.";
  }

  if (text.includes("invalid") || text.includes("unsupported")) {
    return "Review the selected action and scan status, then try again.";
  }

  if (text.includes("trip not found")) {
    return "Refresh the trips list and reopen the correct trip.";
  }

  if (text.includes("shipment not found")) {
    return "Confirm the shipment still exists, then rescan or enter the label manually.";
  }

  if (text.includes("failed to reconcile")) {
    return "Refresh reconciliation. If it still fails, check that the source manifest and delivery trip are available.";
  }

  if (text.includes("failed to load scanner data")) {
    return "Refresh the scanner and confirm your session is still signed in.";
  }

  if (text.includes("failed to execute database action")) {
    return "Retry the action. If it repeats, refresh the trip and check the current status and manifest lock.";
  }

  if (text.includes("failed to check scanned label")) {
    return "Retry the scan or manual entry after refreshing the trip.";
  }

  if (text.includes("failed to process scan action")) {
    return "Refresh the trip, confirm the quantity and selected status, then try again.";
  }

  if (state?.action === "UNLOAD") {
    return "Check that the trip is ARRIVED, the manifest is unlocked, and the package has loaded quantity.";
  }

  if (state?.action === "LOAD") {
    return "Check that the trip is active, the manifest is unlocked, and the package still has pending quantity.";
  }

  return "Review the trip status, manifest lock, selected action, and scanned label, then try again.";
}
