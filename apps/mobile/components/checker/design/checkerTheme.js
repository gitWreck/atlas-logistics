// Shared design tokens for the Checker account.
// Derived from the approved reference mockups: each functional area has a
// dedicated accent color, and cards / scan frames / headers share one look.

// Section accent palette (matches reference screens)
export const SECTION = {
  available: {
    key: "available",
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    soft: "#eff6ff",
    softDark: "#1e3a8a",
    label: "Available",
  },
  load: {
    key: "load",
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    soft: "#eff6ff",
    softDark: "#1e3a8a",
    label: "Load to Van",
  },
  route: {
    key: "route",
    accent: "#16a34a",
    accentDark: "#15803d",
    soft: "#f0fdf4",
    softDark: "#14532d",
    label: "My Deliveries",
  },
  delivered: {
    key: "delivered",
    accent: "#16a34a",
    accentDark: "#15803d",
    soft: "#f0fdf4",
    softDark: "#14532d",
    label: "Delivered",
  },
  offload: {
    key: "offload",
    accent: "#f97316",
    accentDark: "#ea580c",
    soft: "#fff7ed",
    softDark: "#7c2d12",
    label: "Offload",
  },
  return: {
    key: "return",
    accent: "#f97316",
    accentDark: "#ea580c",
    soft: "#fff7ed",
    softDark: "#7c2d12",
    label: "Return to Warehouse",
  },
  failed: {
    key: "failed",
    accent: "#dc2626",
    accentDark: "#b91c1c",
    soft: "#fef2f2",
    softDark: "#7f1d1d",
    label: "Failed Delivery",
  },
  info: {
    key: "info",
    accent: "#7c3aed",
    accentDark: "#6d28d9",
    soft: "#f5f3ff",
    softDark: "#4c1d95",
    label: "Scan Info",
  },
};

// Neutral, shared spacing / radius / typography scale.
export const TOKENS = {
  radius: { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  font: {
    h1: 22,
    h2: 18,
    title: 16,
    body: 14,
    label: 12,
    micro: 10,
  },
};

// Resolve a section's accent + soft background for the current color scheme.
export function getSection(key, scheme = "light") {
  const s = SECTION[key] || SECTION.available;
  return {
    ...s,
    accent: s.accent,
    accentActive: scheme === "dark" ? s.accentDark : s.accent,
    softBg: scheme === "dark" ? s.softDark : s.soft,
  };
}

// Soft shadow style shared across cards (no-op elevation on web is fine).
export const cardShadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};
