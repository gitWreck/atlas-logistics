"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faCommentDots,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { sendManualSms } from "@/app/utility/FirebaseFunctions";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";

export default function CustomerMessageWidget({ shipment, isDark = false }) {
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const theme = getWidgetThemeClasses(isDark);

  const recipientName = shipment?.recipient?.name || "Customer";
  const recipientPhone = shipment?.recipient?.phone;

  const handleSendMessage = async () => {
    if (!messageBody.trim() || !recipientPhone) return;

    setLoading(true);
    setResult(null);

    try {
      await sendManualSms({
        phoneNumber: recipientPhone,
        message: messageBody,
        shipmentId: shipment.id,
        relatedTo: "SHIPMENT",
      });

      setResult({
        success: true,
        phoneNumber: recipientPhone,
      });
      setMessageBody("");
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!shipment) return null;

  return (
    <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
      <h3
        className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.title}`}
      >
        <FontAwesomeIcon icon={faCommentDots} className="text-emerald-500" />
        Message Recipient
      </h3>

      <p className={`text-xs mb-4 ${theme.bodyText}`}>
        Send a direct SMS update to the recipient for{" "}
        <strong>{shipment.trackingNumber || "this shipment"}</strong>.
      </p>

      <div
        className={`mb-3 p-3 border rounded-lg flex justify-between items-center text-xs ${
          isDark
            ? "bg-slate-900/50 border-slate-700/50"
            : "bg-white border-slate-200"
        }`}
      >
        <span className={theme.statText}>
          To: <b className={theme.statStrong}>{recipientName}</b>
        </span>

        <span className={`font-mono ${theme.statText}`}>
          {recipientPhone || "No Phone Number"}
        </span>
      </div>

      <textarea
        className={`w-full border rounded-lg p-3 text-sm focus:border-emerald-500 focus:outline-none mb-3 h-24 resize-none ${theme.textarea} ${
          isDark ? "placeholder:text-slate-600" : "placeholder:text-slate-500"
        }`}
        placeholder={`Hi ${recipientName}, regarding your package...`}
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        disabled={loading || !recipientPhone}
      />

      {result?.success && (
        <div
          className={`mb-4 p-3 border rounded-lg flex justify-between items-center text-xs ${theme.successBox}`}
        >
          <span className={`font-bold ${theme.successText}`}>
            Message Sent!
          </span>

          <span className={theme.statText}>
            To: <b className={theme.statStrong}>{result.phoneNumber}</b>
          </span>
        </div>
      )}

      <button
        onClick={handleSendMessage}
        disabled={loading || !messageBody.trim() || !recipientPhone}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin />
            Sending...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faPaperPlane} />
            Send SMS
          </>
        )}
      </button>

      <div
        className={`mt-3 flex items-start gap-2 text-[10px] p-2 rounded ${theme.noteBox}`}
      >
        <FontAwesomeIcon
          icon={faExclamationTriangle}
          className="text-slate-600 mt-0.5"
        />
        <span>
          Note: This sends a real SMS to the recipient linked to this shipment.
          Standard messaging rates may apply.
        </span>
      </div>
    </div>
  );
}
