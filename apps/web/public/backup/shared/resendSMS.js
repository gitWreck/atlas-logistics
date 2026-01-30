/*********************************************************
 * Resend a previously sent SMS (CANONICAL, SAFE)
 *
 * - Uses Firebase Callable (auth + role enforced)
 * - Backend ALWAYS rebuilds SMS
 * - Frontend is NEVER authoritative
 * - Logged separately as RESEND
 *********************************************************/

import { getFunctions, httpsCallable } from "firebase/functions";

/* ======================================================
   RESEND SMS
====================================================== */
export async function resendSMS(log) {
  /* -----------------------------------------------
     VALIDATION (HARD FAIL)
  ----------------------------------------------- */
  if (
    !log ||
    typeof log !== "object" ||
    !log.trackingId ||
    !log.phone ||
    !log.status
  ) {
    throw new Error("Invalid SMS log payload");
  }

  // Strict PH mobile sanity check (no mutation)
  if (!/^09\d{9}$/.test(log.phone)) {
    throw new Error("Invalid phone format in SMS log");
  }

  /* -----------------------------------------------
     CALLABLE (REGION-LOCKED)
  ----------------------------------------------- */
  const functions = getFunctions(undefined, "asia-southeast1");
  const sendSMS = httpsCallable(functions, "sendSMS");

  try {
    const res = await sendSMS({
      trackingId: log.trackingId,
      phone: log.phone,
      status: log.status,
      delayReason: log.delayReason ?? null,
      delayCleared: log.delayCleared ?? false,

      // 🧾 Explicit resend metadata (audit-only)
      resend: true,
      resendSource: "sms_history_modal"
    });

    return res.data;
  } catch (err) {
    console.error("Resend SMS failed:", err);

    // Preserve callable error info if available
    const message =
      err?.code
        ? `SMS resend failed (${err.code})`
        : err?.message || "Failed to resend SMS";

    throw new Error(message);
  }
}
