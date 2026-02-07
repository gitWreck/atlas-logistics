import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faSpinner,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import { sendManualSms } from "@/app/utility/FirebaseFunctions";

export default function DriverMessageWidget({ trip }) {
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
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
        <FontAwesomeIcon icon={faTruckFast} className="text-blue-500" />
        Message Driver
      </h3>

      <div className="text-xs text-slate-500 mb-3 flex justify-between bg-slate-900/50 p-2 rounded border border-slate-700/50">
        <span>
          Driver:{" "}
          <span className="text-slate-300 font-medium">{driverName}</span>
        </span>
        <span className="font-mono text-slate-400">
          {driverPhone || "No Phone Linked"}
        </span>
      </div>

      <textarea
        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-blue-500 focus:outline-none mb-3 h-20 resize-none placeholder:text-slate-600"
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
