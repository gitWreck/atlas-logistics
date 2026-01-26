const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { syncTrackingPublicCore } = require("./src/syncTrackingPublic");

/**
 * 🔄 Auto-repair public tracking whenever tracking_records changes
 */
exports.autoRepairTrackingPublic = onDocumentWritten(
  {
    region: "asia-southeast1",
    document: "tracking_records/{trackingNumber}"
  },
  async (event) => {
    const after = event.data.after?.data();
    if (!after) return;

    // Only sync public shipments
    if (after.public !== true) return;

    const trackingNumber = event.params.trackingNumber;

    console.log("🔧 Auto-repair public tracking", trackingNumber);

    await syncTrackingPublicCore(trackingNumber);
  }
);
