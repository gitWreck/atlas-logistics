const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

exports.autoSetPublic = onDocumentCreated(
  "tracking_records/{id}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const ref = snap.ref;

    const createdBy = data.createdBy;
    const createdRole = data.createdRole || "";

    const allowPublic =
      createdRole === "admin" ||
      createdRole === "manager" ||
      createdBy === "Admin" ||
      createdBy === "Manager";

    if (allowPublic && data.public !== true) {
      await ref.update({ public: true });
    }
  }
);
