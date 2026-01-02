/**
 * =========================================================
 * BULK CSV UPLOAD (PRODUCTION-GRADE)
 * ---------------------------------------------------------
 * ✔ No alert() spam
 * ✔ Row-by-row result reporting
 * ✔ Required field guards
 * ✔ Auto-detect origin/destination from labels
 * ✔ Graceful failure handling
 * ✔ Throttled writes
 * =========================================================
 */

import { parseCSV, normalizeLocation, sleep } from "./csvUtils.js";

/**
 * Initialize Bulk Upload
 */
export function initBulkUpload({
  bulkFile,
  bulkUploadBtn,
  createShipmentCallable,
  onRowResult
}) {
  if (!bulkFile || !bulkUploadBtn || !createShipmentCallable) return;

  bulkUploadBtn.onclick = async () => {
    /* ===============================
       PRE-CHECK
    =============================== */
    if (!bulkFile.files.length) {
      onRowResult?.({
        row: {},
        status: "error",
        reason: "No CSV file selected"
      });
      return;
    }

    /* ===============================
       LOAD & PARSE CSV
    =============================== */
    const file = bulkFile.files[0];
    const text = await file.text();
    const rows = parseCSV(text);

    let ok = 0;
    let fail = 0;

    bulkUploadBtn.disabled = true;
    bulkUploadBtn.textContent = "Uploading…";

    /* ===============================
       PROCESS ROWS
    =============================== */
    for (const r of rows) {
      /* ---- Required Fields ---- */
      if (!r.customerName || !r.customerPhone) {
        fail++;
        onRowResult?.({
          row: r,
          status: "error",
          reason: "Missing customer fields"
        });
        continue;
      }

      /* ---- Resolve Locations ---- */
      const originCode =
        r.originCode || normalizeLocation(r.originLabel);

      const destinationCode =
        r.destinationCode || normalizeLocation(r.destinationLabel);

      if (!originCode || !destinationCode) {
        fail++;
        onRowResult?.({
          row: r,
          status: "error",
          reason: "Invalid or unknown origin / destination"
        });
        continue;
      }

      /* ---- Create Shipment ---- */
      try {
        await createShipmentCallable({
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          originCode,
          destinationCode,
          originLabel: r.originLabel || "",
          destinationLabel: r.destinationLabel || ""
        });

        ok++;
        onRowResult?.({
          row: r,
          status: "success"
        });
      } catch (e) {
        fail++;
        onRowResult?.({
          row: r,
          status: "error",
          reason: e.message || "Create failed"
        });
      }

      /* ---- Throttle ---- */
      await sleep(120);
    }

    /* ===============================
       CLEANUP
    =============================== */
    bulkUploadBtn.disabled = false;
    bulkUploadBtn.textContent = "📄 Bulk Upload CSV";
  };
}
