import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faMapMarkerAlt,
  faPhone,
  faFileContract,
} from "@fortawesome/free-solid-svg-icons";
import TripOperations from "./TripOperations"; // Your existing operations component
import DriverMessageWidget from "../messaging/DriverMessageWidget";

export default function TripToolsTab({ data, onRefresh }) {
  const [messageBody, setMessageBody] = useState("");

  // const handleSendMessage = () => {
  //   // Replace with your actual SMS/Push Notification logic
  //   alert(
  //     `Sending Message to Driver (${data.driverName}):\n\n"${messageBody}"`,
  //   );
  //   setMessageBody(""); // Clear after sending
  // };

  return (
    <div className="animate-in zoom-in-95 duration-200 space-y-6">
      {/* 1. CRITICAL OPERATIONS (Status, Delay, Assign) */}
      <TripOperations
        tripId={data.tripId}
        isLocked={data.manifestLocked}
        onSuccess={() => {
          onRefresh();
          // Optional: Trigger a parent refresh if needed
          console.log("Operation successful");
        }}
      />

      <hr className="border-slate-800" />

      {/* 2. COMMUNICATION CARD */}
      <DriverMessageWidget trip={data} />
      {/* <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <FontAwesomeIcon icon={faPaperPlane} className="text-emerald-500" />
          Message Driver
        </h3>

        <div className="text-xs text-slate-500 mb-2 flex justify-between">
          <span>
            To:{" "}
            <span className="text-slate-300 font-medium">
              {data.driverName || "Unassigned"}
            </span>
          </span>
          <span className="font-mono text-slate-600">
            {data.driverPhone || "No Phone"}
          </span>
        </div>

        <textarea
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none mb-3 h-24 resize-none transition-colors"
          placeholder="Type instructions or updates here..."
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
        />

        <button
          onClick={handleSendMessage}
          disabled={!messageBody.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
        >
          Send Message
        </button>
      </div> */}

      {/* 3. QUICK ACTIONS GRID */}
      {/* <div className="grid grid-cols-2 gap-3">
        <button className="p-3 bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-lg" />
          <span className="text-xs font-bold">Track GPS</span>
        </button>

        <button className="p-3 bg-slate-800 border border-slate-700 hover:border-blue-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <FontAwesomeIcon icon={faPhone} className="text-lg" />
          <span className="text-xs font-bold">Call Driver</span>
        </button>

        <button className="p-3 bg-slate-800 border border-slate-700 hover:border-amber-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all shadow-sm hover:shadow-md col-span-2">
          <FontAwesomeIcon icon={faFileContract} className="text-lg" />
          <span className="text-xs font-bold">View Incident Reports</span>
        </button>
      </div> */}
    </div>
  );
}
