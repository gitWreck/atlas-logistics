"use client";

import { useEffect, useState } from "react";
import { getShipmentCustodyTimeline } from "@/app/utility/FirebaseFunctions";

export function useShipmentCustodyTimeline(shipmentId, enabled = true) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !shipmentId) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;

    const loadTimeline = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getShipmentCustodyTimeline({
          shipmentId: String(shipmentId),
        });
        if (cancelled) return;
        setEvents(response?.data?.events || []);
      } catch (loadError) {
        console.error("Custody timeline fetch failed:", loadError);
        if (!cancelled) {
          setError(loadError);
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [shipmentId, enabled]);

  return { events, loading, error, reload: () => {} };
}
