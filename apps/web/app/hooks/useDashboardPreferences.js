"use client";

import { useCallback, useMemo } from "react";
import { usePersistedState } from "./usePersistedState";

const DARK_MODE_KEY = "atlas.web.darkMode";

export function useDashboardPreferences(role, validTabIds) {
  const defaultTab = validTabIds[0] ?? "overview";

  const tabValidator = useMemo(
    () => (value) =>
      typeof value === "string" && validTabIds.includes(value),
    [validTabIds],
  );

  const [isDark, setIsDark] = usePersistedState(DARK_MODE_KEY, false, {
    validate: (value) => typeof value === "boolean",
  });

  const [activeTab, setActiveTab] = usePersistedState(
    `atlas.web.activeTab.${role}`,
    defaultTab,
    { validate: tabValidator },
  );

  const toggleDarkMode = useCallback(
    () => setIsDark((prev) => !prev),
    [setIsDark],
  );

  return {
    isDark,
    setIsDark,
    toggleDarkMode,
    activeTab,
    setActiveTab,
  };
}
