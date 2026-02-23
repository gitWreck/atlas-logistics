import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import { sendManualSms } from "@/app/utility/FirebaseFunctions";

export default function DriverMessageWidget({ trip, isDark = false }) {
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);

  // Safe access to driver info
  const driverName = trip?.driverName || "Unassigned";
  // Ensure you are actually saving 'driverPhone' on the trip object!
  // If it's only on the user object, you might need to fetch it or ensure it's copied to the trip doc.
  const driverPhone = trip?.driverPhone || trip?.driver?.phone;

  const handleSendMessage = async () => {
    if (!messageBody.trim() || !driverPhone) return;

    setLoading(true);
    try {
      await sendManualSms({
        phoneNumber: driverPhone,
        message: messageBody,
        tripId: trip.id, // Links SMS log to this trip
        relatedTo: "TRIP_DRIVER",
      });

      alert("Message sent to driver!");
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
    <div className={`border rounded-xl p-5 shadow-sm ${
      isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
    }`}>
      <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${
        isDark ? "text-slate-300" : "text-slate-800"
      }`}>
        <FontAwesomeIcon icon={faTruckFast} className="text-blue-500" />
        Message Driver
      </h3>

      <div className={`text-xs mb-3 flex justify-between p-2 rounded border ${
        isDark ? "text-slate-500 bg-slate-900/50 border-slate-700/50" : "text-slate-600 bg-white border-slate-200"
      }`}>
        <span>
          Driver:{" "}
          <span className={`font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>{driverName}</span>
        </span>
        <span className={`font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          {driverPhone || "No Phone Linked"}
        </span>
      </div>

      <textarea
        className={`w-full border rounded-lg p-3 text-sm focus:border-blue-500 focus:outline-none mb-3 h-20 resize-none ${
          isDark ? "bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
        }`}
        placeholder="Update location, delays, or instructions..."
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        disabled={loading || !driverPhone}
      />

      <button
        onClick={handleSendMessage}
        disabled={loading || !messageBody.trim() || !driverPhone}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
      >
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin /> Sending...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faPaperPlane} /> Send to Driver
          </>
        )}
      </button>
    </div>
  );
}
