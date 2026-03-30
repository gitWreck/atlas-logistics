"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullhorn,
  faPaperPlane,
  faSpinner,
  faExclamationTriangle,
  faCalendarDays,
} from "@fortawesome/free-solid-svg-icons";
import { broadcastTripMessage } from "@/app/utility/FirebaseFunctions";
import { TEMPLATES } from "@/app/utility/constant/templates";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";

export default function TripBroadcastWidget({ trip, isDark = false }) {
  const [messageBody, setMessageBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const theme = getWidgetThemeClasses(isDark);

  const handleTemplateChange = (e) => {
    const tempId = e.target.value;
    setSelectedTemplateId(tempId);
    setScheduledDate("");

    if (!tempId) {
      setMessageBody("");
      return;
    }

    const template = TEMPLATES.find((t) => t.id === tempId);
    if (template) {
      setMessageBody(template.text);
    }
  };

  useEffect(() => {
    if (selectedTemplateId === "SCHEDULED" && scheduledDate) {
      const template = TEMPLATES.find((t) => t.id === "SCHEDULED");
      const formattedDate = format(
        new Date(scheduledDate),
        "MMM d, yyyy h:mm a",
      );

      const newText = template.text.replace("[DATE]", formattedDate);
      setMessageBody(newText);
    }
  }, [scheduledDate, selectedTemplateId]);

  const handleBroadcast = async () => {
    if (!messageBody.trim()) return;

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
    } catch (error) {
      console.error(error);
      alert("Broadcast Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!trip) return null;

  const needsDate = TEMPLATES.find(
    (t) => t.id === selectedTemplateId,
  )?.requiresDate;

  return (
    <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
      <h3
        className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.title}`}
      >
        <FontAwesomeIcon icon={faBullhorn} className="text-amber-500" />
        Broadcast to Customers
      </h3>

      <p className={`text-xs mb-4 ${theme.bodyText}`}>
        Send a bulk SMS notification to all customers with active shipments on{" "}
        <strong>{trip.tripId || "this trip"}</strong>.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <select
          value={selectedTemplateId}
          onChange={handleTemplateChange}
          className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 outline-none ${theme.input}`}
        >
          <option value="">-- Select a Message Template --</option>
          {TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>

        {needsDate && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  className={theme.iconMuted}
                />
              </div>

              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={`pl-9 border rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 outline-none w-full sm:w-auto ${theme.warningInput}`}
              />
            </div>
          </div>
        )}
      </div>

      <textarea
        className={`w-full border rounded-lg p-3 text-sm focus:border-amber-500 focus:outline-none mb-3 h-24 resize-none ${theme.textarea}`}
        placeholder="Message preview..."
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        disabled={loading}
      />

      {result && (
        <div
          className={`mb-4 p-3 border rounded-lg flex justify-between items-center text-xs ${theme.successBox}`}
        >
          <span className={`font-bold ${theme.successText}`}>
            Broadcast Complete!
          </span>

          <div className="flex gap-3">
            <span className={theme.statText}>
              Sent: <b className={theme.statStrong}>{result.sent}</b>
            </span>

            {result.failed > 0 && (
              <span className="text-red-400">
                Failed: <b>{result.failed}</b>
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleBroadcast}
        disabled={loading || !messageBody.trim()}
        className={theme.primaryButton}
      >
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin />
            Sending Broadcast...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faPaperPlane} />
            Send to All Customers
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
          Note: This will send real SMS messages to all unique phone numbers on
          the manifest. Standard rates apply.
        </span>
      </div>
    </div>
  );
}
