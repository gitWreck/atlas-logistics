"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faTruckFast,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { sendManualSms } from "@/app/utility/FirebaseFunctions";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";

export default function DriverMessageWidget({ trip, isDark = false }) {
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const theme = getWidgetThemeClasses(isDark);

  const driverName = trip?.driverName || "Unassigned";
  const driverPhone = trip?.driverPhone || trip?.driver?.phone;

  const handleSendMessage = async () => {
    if (!messageBody.trim() || !driverPhone) return;

    setLoading(true);
    setResult(null);

    try {
      await sendManualSms({
        phoneNumber: driverPhone,
        message: messageBody,
        tripId: trip.id,
        relatedTo: "TRIP_DRIVER",
      });

      setResult({
        success: true,
        phoneNumber: driverPhone,
      });
      setMessageBody("");
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!trip) return null;

  return (
    <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
      <h3
        className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.title}`}
      >
        <FontAwesomeIcon icon={faTruckFast} className="text-blue-500" />
        Message Driver
      </h3>

      <p className={`text-xs mb-4 ${theme.bodyText}`}>
        Send a direct SMS update to the assigned driver for{" "}
        <strong>{trip.tripId || "this trip"}</strong>.
      </p>

      <div
        className={`mb-3 p-3 border rounded-lg flex justify-between items-center text-xs ${
          isDark
            ? "bg-slate-900/50 border-slate-700/50"
            : "bg-white border-slate-200"
        }`}
      >
        <span className={theme.statText}>
          Driver: <b className={theme.statStrong}>{driverName}</b>
        </span>

        <span className={`font-mono ${theme.statText}`}>
          {driverPhone || "No Phone Linked"}
        </span>
      </div>

      <textarea
        className={`w-full border rounded-lg p-3 text-sm focus:border-blue-500 focus:outline-none mb-3 h-24 resize-none ${theme.textarea} ${
          isDark ? "placeholder:text-slate-600" : "placeholder:text-slate-500"
        }`}
        placeholder="Update location, delays, or instructions..."
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        disabled={loading || !driverPhone}
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
        disabled={loading || !messageBody.trim() || !driverPhone}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
      >
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin />
            Sending...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faPaperPlane} />
            Send to Driver
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
          Note: This sends a real SMS to the currently assigned driver number.
          Standard messaging rates may apply.
        </span>
      </div>
    </div>
  );
}
