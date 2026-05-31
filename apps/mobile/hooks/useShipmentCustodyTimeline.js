import { useEffect, useState } from "react";
import { getShipmentCustodyTimeline } from "../components/utilities/FirebaseFunctions";

export function useShipmentCustodyTimeline(
  shipmentId,
  enabled = true,
  pieceId = null,
) {
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
        const payload = { shipmentId: String(shipmentId) };
        if (pieceId) {
          payload.pieceId = String(pieceId);
        }
        const response = await getShipmentCustodyTimeline(payload);
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
  }, [shipmentId, enabled, pieceId]);

  return { events, loading, error };
}
