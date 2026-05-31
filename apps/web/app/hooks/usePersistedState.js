"use client";

import { useCallback, useEffect, useState } from "react";

function readStoredValue(key, initialValue, validate) {
  if (typeof window === "undefined") return initialValue;

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return initialValue;

    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) return initialValue;
    return parsed;
  } catch {
    return initialValue;
  }
}

export function usePersistedState(key, initialValue, options = {}) {
  const { validate } = options;
  const [value, setValue] = useState(() =>
    readStoredValue(key, initialValue, validate),
  );

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota or privacy-mode errors.
    }
  }, [key, value]);

  const setPersistedValue = useCallback((next) => {
    setValue((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  return [value, setPersistedValue];
}
