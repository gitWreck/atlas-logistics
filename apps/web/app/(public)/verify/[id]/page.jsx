"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions, db } from "@/lib/firebase"; // Ensure db is imported
import { doc, getDoc } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTimesCircle,
  faShieldAlt,
  faSpinner,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { verifyTripManifest } from "@/app/utility/FirebaseFunctions";

export default function VerifyPage() {
  const { id: tripId } = useParams(); // Get ID from URL
  const [status, setStatus] = useState("LOADING"); // LOADING, VALID, TAMPERED, ERROR
  const [data, setData] = useState(null);
  const [drift, setDrift] = useState(null);

  useEffect(() => {
    if (!tripId) return;

    const performVerification = async () => {
      try {
        // 1. Get the Trip Doc first to find the Manifest ID
        // (Because the QR code links to the Trip ID, but verification needs Manifest ID)
        const tripRef = doc(db, "truck_trips", tripId);
        const tripSnap = await getDoc(tripRef);

        if (!tripSnap.exists()) {
          throw new Error("Trip ID not found in system.");
        }

        const tripData = tripSnap.data();
        const manifestId = tripData.manifestId;

        if (!manifestId) {
          setStatus("ERROR");
          setData({ error: "Trip exists but has no locked manifest." });
          return;
        }

        // 2. Call the Cloud Function
        // This is the backend logic you already wrote!
        const result = await verifyTripManifest({ manifestId });

        const verifyData = result.data;

        if (verifyData.status === "VALID") {
          setStatus("VALID");
        } else {
          setStatus("TAMPERED");
        }

        setData(verifyData);
        setDrift(verifyData.drift);
      } catch (err) {
        console.error(err);
        setStatus("ERROR");
        setData({ error: err.message });
      }
    };

    performVerification();
  }, [tripId]);

  // --- RENDER STATES ---

  if (status === "LOADING") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className="text-4xl text-blue-500 mb-4"
        />
        <h2 className="text-xl font-bold animate-pulse">
          Verifying Cryptographic Seal...
        </h2>
        <p className="text-slate-400 text-sm mt-2">
          Connecting to Atlas Ledger
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      {/* HEADER LOGO */}
      <div className="mb-8 font-black text-2xl tracking-tighter text-slate-900">
        ATLAS <span className="text-blue-600">VERIFY</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* STATUS BANNER */}
        <div
          className={`p-8 flex flex-col items-center text-center ${
            status === "VALID" ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 ${
              status === "VALID"
                ? "bg-emerald-100 text-emerald-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            <FontAwesomeIcon
              icon={status === "VALID" ? faCheckCircle : faTimesCircle}
            />
          </div>

          <h1
            className={`text-2xl font-black uppercase ${
              status === "VALID" ? "text-emerald-900" : "text-red-900"
            }`}
          >
            {status === "VALID" ? "Official Record" : "Integrity Failed"}
          </h1>

          <p
            className={`font-bold mt-1 ${
              status === "VALID" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {status === "VALID"
              ? "Cryptographic Seal Verified"
              : "Manifest Has Been Altered"}
          </p>
        </div>

        {/* DETAILS */}
        <div className="p-6 space-y-4">
          {/* Timestamp */}
          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Verified At
            </span>
            <span className="text-sm font-mono font-bold text-slate-700">
              {new Date().toLocaleString()}
            </span>
          </div>

          {/* Trip ID */}
          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Trip ID
            </span>
            <span className="text-sm font-mono font-bold text-slate-700">
              {tripId}
            </span>
          </div>

          {/* Hash Display */}
          {data?.recomputedHash && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faShieldAlt} /> Digital Fingerprint
                (SHA-256)
              </div>
              <div className="font-mono text-[10px] break-all text-slate-600 leading-tight">
                {data.recomputedHash}
              </div>
            </div>
          )}

          {/* DRIFT WARNING (If Valid but Data Changed) */}
          {drift?.hasDrift && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                <FontAwesomeIcon icon={faExclamationTriangle} /> Data Drift
                Detected
              </div>
              <p className="text-xs text-amber-800 mb-2">
                The manifest seal is valid, but the live database has changed
                since locking:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {drift.details.map((msg, i) => (
                  <li key={i} className="text-[10px] text-amber-900 font-mono">
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
          <p className="text-[10px] text-slate-400">
            Atlas Logistics Platform • Secure Ledger Verification
          </p>
        </div>
      </div>
    </div>
  );
}
