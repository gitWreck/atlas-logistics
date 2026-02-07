import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullhorn,
  faPaperPlane,
  faSpinner,
  faExclamationTriangle,
  // NEW ICONS IMPORTED HERE:
  faTruckFast,
  faCloudShowersHeavy,
  faShip,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

// UPDATED TEMPLATES WITH ICONS
const TEMPLATES = [
  {
    icon: faTruckFast,
    label: "Out for Delivery",
    text: "Atlas Logistics: Your package is out for delivery today. Please ensure someone is available to receive it.",
  },
  {
    icon: faCloudShowersHeavy,
    label: "Weather Delay",
    text: "Atlas Logistics: Shipments are slightly delayed due to bad weather conditions. We apologize for the inconvenience.",
  },
  {
    icon: faShip,
    label: "Arrived at Port",
    text: "Atlas Logistics: Your cargo has arrived at the destination port and is being sorted for final delivery.",
  },
  {
    icon: faCheckCircle,
    label: "Trip Completed",
    text: "Atlas Logistics: Our delivery run is complete. If you haven't received your package, please contact support immediately.",
  },
];

export default function TripBroadcastWidget({ trip }) {
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleApplyTemplate = (text) => {
    setMessageBody(text);
    setResult(null);
  };

  const handleBroadcast = async () => {
    if (!messageBody.trim()) return;

    if (
      !confirm(
        "⚠️ BROADCAST WARNING\n\nAre you sure you want to send this SMS to ALL customers on this trip?",
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const fn = httpsCallable(functions, "broadcastTripMessage");
      const resp = await fn({
        tripId: trip.id,
        message: messageBody,
      });

      setResult(resp.data);
      setMessageBody("");
    } catch (error) {
      console.error(error);
      alert("Broadcast Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!trip) return null;

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

      {/* UPDATED TEMPLATES RENDERER */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TEMPLATES.map((t, idx) => (
          <button
            key={idx}
            onClick={() => handleApplyTemplate(t.text)}
            className="flex items-center gap-2 text-[10px] uppercase font-bold px-3 py-2 rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all text-left"
          >
            <FontAwesomeIcon
              icon={t.icon}
              className="text-emerald-500 w-3 h-3"
            />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none mb-3 h-24 resize-none"
        placeholder="Select a template or type a custom broadcast message..."
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
