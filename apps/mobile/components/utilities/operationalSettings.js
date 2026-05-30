import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { PH_LOCATIONS } from "./PhilippinesData";

const SETTINGS_STORAGE_KEY = "atlas.operationalSettings";

const DEFAULT_OPERATIONAL_SETTINGS = {
  truckTypes: [],
  warehouses: [],
  phLocations: PH_LOCATIONS,
};

function normalizeOperationalSettings(data = {}) {
  return {
    truckTypes: Array.isArray(data.truckTypes) ? data.truckTypes : [],
    warehouses: Array.isArray(data.warehouses) ? data.warehouses : [],
    phLocations:
      data.phLocations &&
      typeof data.phLocations === "object" &&
      !Array.isArray(data.phLocations) &&
      Object.keys(data.phLocations).length
        ? data.phLocations
        : PH_LOCATIONS,
  };
}

async function readCachedSettings() {
  try {
    const cached = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    return cached
      ? normalizeOperationalSettings(JSON.parse(cached))
      : DEFAULT_OPERATIONAL_SETTINGS;
  } catch {
    return DEFAULT_OPERATIONAL_SETTINGS;
  }
}

async function cacheOperationalSettings(settings) {
  await AsyncStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeOperationalSettings(settings)),
  );
}

export function useOperationalSettings() {
  const [settings, setSettings] = useState(DEFAULT_OPERATIONAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setLoading(true);
      setError(null);

      const cachedSettings = await readCachedSettings();

      if (isMounted) {
        setSettings(cachedSettings);
      }

      try {
        const snap = await getDoc(doc(db, "app_settings", "operational"));
        const nextSettings = normalizeOperationalSettings(
          snap.exists() ? snap.data() : DEFAULT_OPERATIONAL_SETTINGS,
        );

        await cacheOperationalSettings(nextSettings);

        if (isMounted) {
          setSettings(nextSettings);
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
