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
};

const darkColors = {
  bg: "#0f172a",
  surface: "#1e293b",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  border: "#334155",
  headerBorder: "#334155",
  inputBg: "#0f172a",
  cardMuted: "#1e293b",
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
