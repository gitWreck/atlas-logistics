import React, { useState, useEffect } from "react";
import { format } from "date-fns"; // Make sure you have date-fns installed
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullhorn,
  faPaperPlane,
  faSpinner,
  faExclamationTriangle,
  faCalendarDays,
} from "@fortawesome/free-solid-svg-icons";
import { broadcastTripMessage } from "@/app/utility/FirebaseFunctions";

// 1. UPDATED TEMPLATES (Added 'requiresDate' flag)
const TEMPLATES = [
  {
    id: "SCHEDULED",
    label: "Scheduled Loading",
    requiresDate: true, // <--- Triggers Date Picker
    text: "Atlas Logistics: Your cargo is scheduled for loading on [DATE]. We will notify you once the truck departs.",
  },
  {
    id: "TRANSIT",
    label: "In Transit",
    text: "Atlas Logistics: The truck has departed and is currently in transit to the destination. Estimated arrival is shortly.",
  },
  {
    id: "OUT_FOR_DELIVERY",
    label: "Out for Delivery",
    text: "Atlas Logistics: Your package is out for delivery today. Please ensure someone is available to receive it.",
  },
  {
    id: "WEATHER",
    label: "Weather Delay",
    text: "Atlas Logistics: Shipments are slightly delayed due to bad weather conditions. We apologize for the inconvenience.",
  },
  {
    id: "MECHANICAL",
    label: "Mechanical Issue",
    text: "Atlas Logistics: We are experiencing a minor mechanical issue with the transport vehicle. We are working to resolve it quickly.",
  },
  {
    id: "PORT_ARRIVED",
    label: "Arrived at Port",
    text: "Atlas Logistics: Your cargo has arrived at the destination port and is being sorted for final delivery.",
  },
  {
    id: "READY_PICKUP",
    label: "Ready for Pickup",
    text: "Atlas Logistics: Your cargo is ready for pickup at our warehouse. Please bring your ID and tracking number.",
  },
  {
    id: "COMPLETED",
    label: "Trip Completed",
    text: "Atlas Logistics: Our delivery run is complete. If you haven't received your package, please contact support immediately.",
  },
];

export default function TripBroadcastWidget({ trip }) {
  const [messageBody, setMessageBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // 2. Handle Dropdown Change
  const handleTemplateChange = (e) => {
    const tempId = e.target.value;
    setSelectedTemplateId(tempId);
    setScheduledDate(""); // Reset date on change

    if (!tempId) {
      setMessageBody("");
      return;
    }

    const template = TEMPLATES.find((t) => t.id === tempId);
    if (template) {
      setMessageBody(template.text);
    }
  };

  // 3. Handle Date Change (Auto-replace [DATE] in text)
  useEffect(() => {
    if (selectedTemplateId === "SCHEDULED" && scheduledDate) {
      const template = TEMPLATES.find((t) => t.id === "SCHEDULED");
      // Format date nicely: "Feb 24, 2026 at 2:00 PM"
      const formattedDate = format(
        new Date(scheduledDate),
        "MMM d, yyyy h:mm a",
      );

      // Replace placeholder with actual date
      const newText = template.text.replace("[DATE]", formattedDate);
      setMessageBody(newText);
    }
  }, [scheduledDate, selectedTemplateId]);

  const handleBroadcast = async () => {
    if (!messageBody.trim()) return;

    // Use your custom showConfirm here if you have it, otherwise fallback to window.confirm
    if (
      !window.confirm(
        "⚠️ BROADCAST WARNING\n\nAre you sure you want to send this SMS to ALL customers on this trip?",
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const resp = await broadcastTripMessage({
        tripId: trip.id,
        message: messageBody,
      });

      setResult(resp.data);
      // Don't clear body immediately so they can see what they sent,
      // or clear it if you prefer.
    } catch (error) {
      console.error(error);
      alert("Broadcast Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!trip) return null;

  // Check if selected template needs a date
  const needsDate = TEMPLATES.find(
    (t) => t.id === selectedTemplateId,
  )?.requiresDate;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-5 shadow-lg">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <FontAwesomeIcon icon={faBullhorn} className="text-amber-500" />
        Broadcast to Customers
      </h3>

      <p className="text-xs text-slate-400 mb-4">
        Send a bulk SMS notification to all customers with active shipments on{" "}
        <strong>{trip.tripId || "this trip"}</strong>.
      </p>

      {/* --- NEW: DROPDOWN & DATE ROW --- */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        {/* Template Dropdown */}
        <select
          value={selectedTemplateId}
          onChange={handleTemplateChange}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none"
        >
          <option value="">-- Select a Message Template --</option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Conditional Date Picker */}
        {needsDate && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className="text-slate-500"
                />
              </div>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="pl-9 bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none w-full sm:w-auto"
              />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <textarea
        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none mb-3 h-24 resize-none"
        placeholder="Message preview..."
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        disabled={loading}
      />

      {/* Result Stats */}
      {result && (
        <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg flex justify-between items-center text-xs">
          <span className="text-emerald-400 font-bold">
            Broadcast Complete!
          </span>
          <div className="flex gap-3">
            <span className="text-slate-300">
              Sent: <b className="text-white">{result.sent}</b>
            </span>
            {result.failed > 0 && (
              <span className="text-red-400">
                Failed: <b>{result.failed}</b>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleBroadcast}
        disabled={loading || !messageBody.trim()}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
      >
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin /> Sending Broadcast...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faPaperPlane} /> Send to All Customers
          </>
        )}
      </button>

      <div className="mt-3 flex items-start gap-2 text-[10px] text-slate-500 bg-slate-950/50 p-2 rounded">
        <FontAwesomeIcon
          icon={faExclamationTriangle}
          className="text-slate-600 mt-0.5"
        />
        <span>
          Note: This will send real SMS messages to all unique phone numbers on
          the manifest. Standard rates apply.
        </span>
      </div>
    </div>
  );
}
