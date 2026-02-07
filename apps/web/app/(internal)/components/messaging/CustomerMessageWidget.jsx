import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faCommentDots,
} from "@fortawesome/free-solid-svg-icons";
import { sendManualSms } from "@/app/utility/FirebaseFunctions";

export default function CustomerMessageWidget({ shipment }) {
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
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
        <FontAwesomeIcon icon={faCommentDots} className="text-emerald-500" />
        Message Recipient
      </h3>

      {/* Recipient Info */}
      <div className="text-xs text-slate-500 mb-3 flex justify-between bg-slate-900/50 p-2 rounded border border-slate-700/50">
        <span>
          To:{" "}
          <span className="text-slate-300 font-medium">{recipientName}</span>
        </span>
        <span className="font-mono text-slate-400">
          {recipientPhone || "No Phone Number"}
        </span>
      </div>

      <textarea
        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none mb-3 h-20 resize-none placeholder:text-slate-600"
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
