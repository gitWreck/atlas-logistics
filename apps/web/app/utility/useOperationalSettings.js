"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  normalizeOperationalSettings,
} from "./settingsDefaults";

const SETTINGS_STORAGE_KEY = "atlas.operationalSettings";

function readCachedSettings() {
  if (typeof window === "undefined") return DEFAULT_OPERATIONAL_SETTINGS;

  try {
    const cached = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return cached
      ? normalizeOperationalSettings(JSON.parse(cached))
      : DEFAULT_OPERATIONAL_SETTINGS;
  } catch {
    return DEFAULT_OPERATIONAL_SETTINGS;
  }
}

export function cacheOperationalSettings(settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeOperationalSettings(settings)),
  );
}

export function useOperationalSettings() {
  const [settings, setSettings] = useState(readCachedSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/app-settings", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load settings");
        }

        const nextSettings = normalizeOperationalSettings(data.settings);

        if (isMounted) {
          setSettings(nextSettings);
          cacheOperationalSettings(nextSettings);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  return useMemo(
    () => ({ settings, loading, error }),
    [settings, loading, error],
  );
}
