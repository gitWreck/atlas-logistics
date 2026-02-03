// apps/mobile/constants/theme.js
import { StyleSheet } from "react-native";

export const COLORS = {
  primary: "#fbbf24", // Amber 400 (Your Driver/Action Color)
  secondary: "#3b82f6", // Blue (Info/Action)
  success: "#10b981", // Green (Start/Success)
  danger: "#ef4444", // Red (Logout/Error)
  slate: "#334155", // Slate 700 (Secondary Buttons)
  logout: "#0690D3", // Blue 600 (Logout/Error)

  bg: "#0f172a", // Slate 900 (Main Background)
  card: "#1e293b", // Slate 800 (Card Background)

  textPrimary: "#f8fafc", // Whiteish
  textSecondary: "#94a3b8", // Grey
};

export const GLOBAL_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  // Common Card Style
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.slate,
    marginBottom: 16,
  },
  // Common Button Style
  btn: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
});
