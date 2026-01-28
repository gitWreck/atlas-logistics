"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";

// Import your new components
import TrackingSearch from "../../components/tracking/TrackingSearch";
import TrackingResult from "../../components/tracking/TrackingResult";

export default function TrackingPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Auto-fetch if URL has ID
  useEffect(() => {
    if (params.id && params.id !== "search") {
      executeTrack(decodeURIComponent(params.id));
    }
  }, [params.id]);

  const executeTrack = async (trackingId) => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      // 1. Fetch from 'tracking_public' (Security: Read-Only for public)
      const docRef = doc(db, "tracking_public", trackingId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setError("Shipment not found. Please check your ID.");
      } else {
        setData({ id: snap.id, ...snap.data() });
      }
    } catch (err) {
      console.error(err);
      setError("System offline. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val) => {
    // If we are on the search page, push URL. If embedded, just fetch.
    router.push(`/track/${encodeURIComponent(val)}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* HEADER */}
        <div className="p-8 text-center bg-slate-950/50 border-b border-slate-800">
          <div className="w-20 h-20 mx-auto mb-3">
            <img
              src="/atlas-logo1.png"
              alt="Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide uppercase">
            Atlas Tracking
          </h1>
        </div>

        {/* SEARCH COMPONENT */}
        <TrackingSearch
          onSearch={handleSearch}
          loading={loading}
          initialValue={
            params.id === "search" ? "" : decodeURIComponent(params.id)
          }
        />

        {/* ERROR STATE */}
        {error && (
          <div className="mx-6 mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            {error}
          </div>
        )}

        {/* RESULT STATE */}
        {data && (
          <TrackingResult
            data={{
              ...data,
              // 1. DUMMY IMAGES FOR TESTING
              images: [
                "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop",
              ],
              // 2. DUMMY STATS (If real data is missing)
              // totals: data.totals || {
              //   totalItems: 15,
              //   loaded: 8,
              //   // 'Pending' is calculated automatically by the component
              // },
            }}
          />
        )}
      </div>
    </div>
  );
}
