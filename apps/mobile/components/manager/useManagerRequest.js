import { useCallback, useEffect, useState } from "react";

export default function useManagerRequest(callable, payload = undefined) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ refresh = false } = {}) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const result = await callable(payload);
        setData(result?.data || null);
      } catch (nextError) {
        console.error("Manager request failed:", nextError);
        setError(nextError);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [callable, JSON.stringify(payload || {})],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, refreshing, error, reload: load };
}
