"use client";
import React, {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

import TrackingSearch from "../../components/tracking/TrackingSearch";
import TrackingResult from "../../components/tracking/TrackingResult";

function normalizeTrackingRef(value = "") {
  return String(value || "").trim().toUpperCase();
}

function TrackingPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [highlightedPackageId, setHighlightedPackageId] = useState(null);
  const [error, setError] = useState("");

  const loadedShipmentIdRef = useRef(null);
  const fetchSeqRef = useRef(0);

  const executeTrack = useCallback(
    async (trackingId, pieceOverride = null) => {
      const normalized = String(trackingId || "").trim();
      if (!normalized) return;

      const requestId = ++fetchSeqRef.current;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/tracking/resolve?code=${encodeURIComponent(normalized)}`,
        );
        const result = await response.json();

        if (requestId !== fetchSeqRef.current) return;

        if (!response.ok || !result.found) {
          setData(null);
          loadedShipmentIdRef.current = null;
          setHighlightedPackageId(null);
          setError(
            result.message || "Tracking number not found. Please check your ID.",
          );
          return;
        }

        const highlightId = pieceOverride || result.matchedPackageId || null;
        const shipmentId = result.shipmentId;

        loadedShipmentIdRef.current = shipmentId;
        setData(result.tracking);
        setHighlightedPackageId(highlightId);

        if (
          result.matchType === "package" &&
          shipmentId &&
          normalizeTrackingRef(shipmentId) !== normalizeTrackingRef(normalized)
        ) {
          const nextUrl = `/track/${encodeURIComponent(shipmentId)}?piece=${encodeURIComponent(result.matchedPackageId || normalized)}`;
          router.replace(nextUrl, { scroll: false });
        }
      } catch (err) {
        if (requestId !== fetchSeqRef.current) return;
        console.error(err);
        setData(null);
        loadedShipmentIdRef.current = null;
        setError("System offline. Please try again later.");
      } finally {
        if (requestId === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (!params.id || params.id === "search") return;

    const trackingId = decodeURIComponent(params.id);
    const pieceParam = searchParams.get("piece");
    const loadedShipmentId = loadedShipmentIdRef.current;

    if (
      loadedShipmentId &&
      normalizeTrackingRef(loadedShipmentId) === normalizeTrackingRef(trackingId)
    ) {
      setHighlightedPackageId(pieceParam || null);
      return;
    }

    executeTrack(trackingId, pieceParam);
  }, [params.id, searchParams, executeTrack]);

  const handleSearch = (val) => {
    const trimmed = String(val || "").trim();
    if (!trimmed) return;

    const nextPath = `/track/${encodeURIComponent(trimmed)}`;
    const currentPath = `/track/${encodeURIComponent(params.id)}`;
    const isSamePath =
      normalizeTrackingRef(decodeURIComponent(params.id || "")) ===
        normalizeTrackingRef(trimmed) && !searchParams.get("piece");

    if (isSamePath) {
      loadedShipmentIdRef.current = null;
      executeTrack(trimmed, null);
      return;
    }

    if (nextPath !== currentPath) {
      loadedShipmentIdRef.current = null;
    }

    router.push(nextPath);
  };

  const initialValue =
    params.id === "search"
      ? ""
      : searchParams.get("piece") || decodeURIComponent(params.id);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-slate-200/70 overflow-hidden relative">
        <div className="p-8 text-center bg-slate-50 border-b border-slate-200">
          <div className="w-20 h-20 mx-auto mb-3">
            <img
              src="/atlas-logo1.png"
              alt="Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <h1 className="text-xl font-bold text-slate-950 tracking-wide uppercase">
            Atlas Tracking
          </h1>
        </div>

        <TrackingSearch
          onSearch={handleSearch}
          loading={loading}
          initialValue={initialValue}
        />

        {error && (
          <div className="mx-6 mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            {error}
          </div>
        )}

        {data && (
          <div
            className={`relative transition-opacity duration-200 ${loading ? "opacity-70" : "opacity-100"}`}
          >
            <TrackingResult
              data={data}
              highlightedPackageId={highlightedPackageId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TrackingPageFallback() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-2xl shadow-slate-200/70">
        Loading tracking details...
      </div>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<TrackingPageFallback />}>
      <TrackingPageContent />
    </Suspense>
  );
}
