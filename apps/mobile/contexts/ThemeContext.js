import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@atlas_theme_preference";

const lightColors = {
  bg: "#f1f5f9",
  surface: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  headerBorder: "#cbd5e1",
  inputBg: "#ffffff",
  cardMuted: "#f8fafc",
  primary: "#0b72ff",
  primaryDeep: "#064fd8",
  primarySoft: "#eaf3ff",
  onPrimary: "#ffffff",
  success: "#22c55e",
  successSoft: "#dcfce7",
  warning: "#f59e0b",
  warningSoft: "#fef3c7",
  danger: "#ef4444",
  dangerSoft: "#fee2e2",
  onDanger: "#ffffff",
  dashboardBg: "#f4f8ff",
  dashboardSurface: "#ffffff",
  dashboardSurfaceMuted: "#f8fbff",
  dashboardBorder: "#dbe8f8",
  dashboardShadow: "#0f2f63",
  iconMuted: "#8ca0bd",
};

const darkColors = {
  bg: "#020b18",
  surface: "#06182b",
  text: "#f1f5f9",
  textMuted: "#aab8cf",
  border: "#143353",
  headerBorder: "#143353",
  inputBg: "#031326",
  cardMuted: "#071d34",
  primary: "#0b7dff",
  primaryDeep: "#045cff",
  primarySoft: "#082b5a",
  onPrimary: "#ffffff",
  success: "#2bd66f",
  successSoft: "#062817",
  warning: "#ffad1f",
  warningSoft: "#2d2108",
  danger: "#ff3654",
  dangerSoft: "#2f1018",
  onDanger: "#ffffff",
  dashboardBg: "#020b18",
  dashboardSurface: "#06182b",
  dashboardSurfaceMuted: "#082039",
  dashboardBorder: "#12375d",
  dashboardShadow: "#000000",
  iconMuted: "#8ea4c6",
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useRNColorScheme() === "dark" ? "dark" : "light";
  const [preference, setPreferenceState] = useState("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") {
          setPreferenceState(v);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const resolvedScheme = useMemo(() => {
    if (preference === "system") return systemScheme;
    return preference;
  }, [preference, systemScheme]);

  useEffect(() => {
    if (!hydrated) return;
    // Appearance.setColorScheme is not implemented on web (react-native-web).
    if (typeof Appearance.setColorScheme !== "function") return;
    if (preference === "light") Appearance.setColorScheme("light");
    else if (preference === "dark") Appearance.setColorScheme("dark");
    else Appearance.setColorScheme(null);
  }, [preference, hydrated]);

  const colors = resolvedScheme === "dark" ? darkColors : lightColors;

  const setPreference = useCallback(async (next) => {
    if (next !== "light" && next !== "dark" && next !== "system") return;
    setPreferenceState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      resolvedScheme,
      colors,
      hydrated,
    }),
    [preference, setPreference, resolvedScheme, colors, hydrated],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
