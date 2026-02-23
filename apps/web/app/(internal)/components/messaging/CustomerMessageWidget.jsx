import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faCommentDots,
} from "@fortawesome/free-solid-svg-icons";
import { sendManualSms } from "@/app/utility/FirebaseFunctions";

export default function CustomerMessageWidget({ shipment, isDark = false }) {
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);

  // Safe access to recipient info
  const recipientName = shipment?.recipient?.name || "Customer";
  const recipientPhone = shipment?.recipient?.phone;

  const handleSendMessage = async () => {
    if (!messageBody.trim() || !recipientPhone) return;

    setLoading(true);
    try {
      await sendManualSms({
        phoneNumber: recipientPhone,
        message: messageBody,
        shipmentId: shipment.id, // Links SMS log to this shipment
        relatedTo: "SHIPMENT",
      });

      alert("Message sent to customer!");
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
    <div className={`rounded-xl p-5 shadow-sm border ${
      isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
    }`}>
      <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${
        isDark ? "text-slate-300" : "text-slate-700"
      }`}>
        <FontAwesomeIcon icon={faCommentDots} className="text-emerald-500" />
        Message Recipient
      </h3>

      {/* Recipient Info */}
      <div className={`text-xs mb-3 flex justify-between p-2 rounded border ${
        isDark ? "text-slate-500 bg-slate-900/50 border-slate-700/50" : "text-slate-600 bg-white border-slate-200"
      }`}>
        <span>
          To:{" "}
          <span className={`font-medium ${isDark ? "text-slate-300" : "text-slate-800"}`}>{recipientName}</span>
        </span>
        <span className={`font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          {recipientPhone || "No Phone Number"}
        </span>
      </div>

      <textarea
        className={`w-full border rounded-lg p-3 text-sm focus:border-emerald-500 focus:outline-none mb-3 h-20 resize-none ${
          isDark ? "bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
        }`}
        placeholder={`Hi ${recipientName}, regarding your package...`}
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        disabled={loading || !recipientPhone}
      />

      <button
        onClick={handleSendMessage}
        disabled={loading || !messageBody.trim() || !recipientPhone}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin /> Sending...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faPaperPlane} /> Send SMS
          </>
        )}
      </button>
    </div>
  );
}
