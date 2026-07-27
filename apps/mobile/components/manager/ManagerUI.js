import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

export const MANAGER_ACCENT = "#4f46e5";

export function ManagerHeader({
  title,
  subtitle,
  back = false,
  actionIcon,
  onAction,
  actions = [],
  titleNumberOfLines = 1,
  titleStyle,
  subtitleStyle,
  titleAdjustsFontSizeToFit = false,
  titleMinimumFontScale = 0.75,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const { role } = useAuth();
  const isQuickAccess = String(pathname || "").includes("/quick/");
  const isManagerShortcut =
    String(pathname || "").includes("/management/") ||
    String(pathname || "").endsWith("/notifications");
  const showBack = back || isQuickAccess;
  const roleLabel =
    role === "admin" || role === "administrator" ? "ADMIN" : "MANAGER";
  const handleBack = () => {
    if (isQuickAccess || isManagerShortcut) {
      router.replace(
        isQuickAccess ? "/(checker)/(tabs)" : "/(manager)/(tabs)",
      );
      return;
    }
    router.back();
  };
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          style={[styles.iconButton, { backgroundColor: colors.cardMuted }]}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={21} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.headerCopy}>
        {!showBack ? (
          <Text style={[styles.eyebrow, { color: MANAGER_ACCENT }]}>
            {roleLabel}
          </Text>
        ) : null}
        <Text
          style={[styles.headerTitle, { color: colors.text }, titleStyle]}
          numberOfLines={titleNumberOfLines}
          adjustsFontSizeToFit={titleAdjustsFontSizeToFit}
          minimumFontScale={titleMinimumFontScale}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.headerSubtitle,
              { color: colors.textMuted },
              subtitleStyle,
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions.length ? (
        <View style={styles.headerActions}>
          {actions.map((action) => {
            const accent =
              action.tone === "green" ? "#059669" : action.color || "#2563eb";
            const background =
              action.tone === "green" ? "#ecfdf5" : "#eff6ff";
            return (
              <Pressable
                key={action.key || action.label}
                onPress={action.onPress}
                style={[
                  styles.headerActionButton,
                  { borderColor: accent, backgroundColor: background },
                ]}
                accessibilityLabel={action.label}
              >
                <Feather name={action.icon} size={13} color={accent} />
                <Text style={[styles.headerActionText, { color: accent }]}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {actionIcon ? (
        <Pressable
          onPress={onAction}
          style={[styles.iconButton, { backgroundColor: colors.cardMuted }]}
          accessibilityLabel={actionIcon}
        >
          <Feather name={actionIcon} size={20} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ManagerCard({ children, style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, subtitle, action, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleCopy}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MetricCard({ label, value, icon, tone = "blue" }) {
  const { colors } = useTheme();
  const palette = {
    blue: [colors.primarySoft, colors.primary],
    green: [colors.successSoft, colors.success],
    amber: [colors.warningSoft, colors.warning],
    red: [colors.dangerSoft, colors.danger],
    teal: [colors.cardMuted, MANAGER_ACCENT],
  }[tone] || [colors.cardMuted, colors.textMuted];
  return (
    <ManagerCard style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: palette[0] }]}>
        <Feather name={icon} size={17} color={palette[1]} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value ?? 0}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </ManagerCard>
  );
}

export function LoadingState({ label = "Loading live operations…" }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.state, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.stateText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = "inbox", title, message }) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.cardMuted }]}>
        <Feather name={icon} size={24} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.stateText, { color: colors.textMuted }]}>{message}</Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.state, { backgroundColor: colors.bg }]}>
      <Feather name="alert-circle" size={28} color={colors.danger} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Unable to load</Text>
      <Text style={[styles.stateText, { color: colors.textMuted }]}>{message}</Text>
      <Pressable style={styles.retry} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function formatDate(value, includeTime = true) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString(undefined, includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

export function displayName(value = {}) {
  return value.name || value.fullName || value.displayName || value.email || "Not assigned";
}

const styles = StyleSheet.create({
  header: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  headerTitle: { fontSize: 23, fontWeight: "900", marginTop: 1 },
  headerSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  headerActionButton: {
    minWidth: 54,
    height: 36,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  headerActionText: { fontSize: 9, fontWeight: "900" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitleCopy: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  sectionAction: { color: MANAGER_ACCENT, fontSize: 13, fontWeight: "800" },
  metricCard: { width: "48.5%", minHeight: 125 },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { fontSize: 25, fontWeight: "900", marginTop: 10 },
  metricLabel: { fontSize: 12, fontWeight: "700", lineHeight: 16, marginTop: 2 },
  state: {
    flex: 1,
    minHeight: 260,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 10 },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  retry: {
    marginTop: 16,
    backgroundColor: MANAGER_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: { color: "#fff", fontWeight: "800" },
});
