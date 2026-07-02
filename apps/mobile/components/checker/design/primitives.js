// Reusable presentational primitives for the Checker account.
// These implement the shared visual language from the reference mockups.
// They are purely presentational — no business logic lives here.
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";
import { TOKENS, getSection, cardShadow } from "./checkerTheme";

/* ----------------------------------------------------------------- *
 * Screen sub-header (colored title + optional subtitle + action)
 * Sits directly below the shared CheckerHeader. Uses a colored title
 * per section (light-theme variant of the reference).
 * ----------------------------------------------------------------- */
export function SectionHeader({
  sectionKey = "available",
  title,
  subtitle,
  rightIcon,
  onRightPress,
  leftIcon,
  onLeftPress,
}) {
  const { colors, resolvedScheme } = useTheme();
  const section = getSection(sectionKey, resolvedScheme);
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          {leftIcon ? (
            <TouchableOpacity
              onPress={onLeftPress}
              style={[styles.headerIconBtn, { borderColor: colors.border }]}
              hitSlop={8}
            >
              <FontAwesome5 name={leftIcon} size={16} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text
            style={[styles.sectionTitle, { color: section.accentActive }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightPress}
            style={[styles.headerIconBtn, { borderColor: colors.border }]}
            hitSlop={8}
          >
            <FontAwesome5 name={rightIcon} size={16} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- *
 * Small uppercase section label (e.g. "TODAY AT A GLANCE")
 * ----------------------------------------------------------------- */
export function GroupLabel({ children, style }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.groupLabel, { color: colors.textMuted }, style]}>
      {children}
    </Text>
  );
}

/* ----------------------------------------------------------------- *
 * Card container with shared radius / border / shadow
 * ----------------------------------------------------------------- */
export function Card({ children, style, onPress, activeOpacity = 0.85 }) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={activeOpacity}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

/* ----------------------------------------------------------------- *
 * Stat card — big number + label + colored icon chip (dashboard)
 * ----------------------------------------------------------------- */
export function StatCard({ value, label, sublabel, icon, color, width = "48%" }) {
  const { colors, resolvedScheme } = useTheme();
  const softBg =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.06)" : `${color}18`;
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.surface, borderColor: colors.border, width },
        cardShadow,
      ]}
    >
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: softBg }]}>
          <FontAwesome5 name={icon} size={15} color={color} />
        </View>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      </View>
      <Text style={[styles.statLabel, { color: colors.text }]}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.statSub, { color: colors.textMuted }]}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- *
 * Quick-action card — icon chip + title + subtitle (dashboard grid)
 * ----------------------------------------------------------------- */
export function QuickAction({ title, subtitle, icon, color, onPress }) {
  const { colors, resolvedScheme } = useTheme();
  const softBg =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.06)" : `${color}18`;
  return (
    <TouchableOpacity
      style={[
        styles.quickAction,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.quickIcon, { backgroundColor: softBg }]}>
        <FontAwesome5 name={icon} size={18} color={color} />
      </View>
      <View style={styles.quickText}>
        <Text style={[styles.quickTitle, { color }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[styles.quickSub, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/* ----------------------------------------------------------------- *
 * Action list row — icon + title + subtitle + chevron (offload menu)
 * ----------------------------------------------------------------- */
export function ActionRow({ title, subtitle, icon, color, onPress, disabled }) {
  const { colors, resolvedScheme } = useTheme();
  const softBg =
    resolvedScheme === "dark" ? "rgba(255,255,255,0.06)" : `${color}18`;
  return (
    <TouchableOpacity
      style={[
        styles.actionRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow,
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <View style={[styles.actionIcon, { backgroundColor: softBg }]}>
        <FontAwesome5 name={icon} size={18} color={color} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.actionSub, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <FontAwesome5 name="chevron-right" size={14} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

/* ----------------------------------------------------------------- *
 * Key/value detail row (result & success detail tables)
 * ----------------------------------------------------------------- */
export function DetailRow({ label, value, valueColor, last }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[styles.detailValue, { color: valueColor || colors.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- *
 * Scan frame — dashed/rounded viewport with colored corner brackets
 * `children` renders the live camera (or a placeholder) behind it.
 * ----------------------------------------------------------------- */
export function ScanFrame({ sectionKey = "load", children, size = 240 }) {
  const { resolvedScheme } = useTheme();
  const section = getSection(sectionKey, resolvedScheme);
  const c = section.accentActive;
  const corner = (pos) => (
    <View
      style={[
        styles.corner,
        pos === "tl" && { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
        pos === "tr" && { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
        pos === "bl" && { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
        pos === "br" && { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
        { borderColor: c },
      ]}
    />
  );
  return (
    <View style={[styles.scanFrame, { width: size, height: size }]}>
      <View style={styles.scanInner}>{children}</View>
      {corner("tl")}
      {corner("tr")}
      {corner("bl")}
      {corner("br")}
      <View style={[styles.scanLine, { backgroundColor: c, shadowColor: c }]} />
    </View>
  );
}

/* ----------------------------------------------------------------- *
 * Buttons
 * ----------------------------------------------------------------- */
export function PrimaryButton({
  label,
  icon,
  onPress,
  color = "#2563eb",
  loading,
  disabled,
  style,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        { backgroundColor: color },
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          {icon ? <FontAwesome5 name={icon} size={15} color="#fff" /> : null}
          <Text style={styles.primaryBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function OutlineButton({ label, icon, onPress, color = "#2563eb", disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.outlineBtn, { borderColor: color }, disabled && { opacity: 0.5 }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      {icon ? <FontAwesome5 name={icon} size={15} color={color} /> : null}
      <Text style={[styles.outlineBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ----------------------------------------------------------------- *
 * Compact stat pill row (My Route header stats)
 * ----------------------------------------------------------------- */
export function StatPillRow({ items }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.pillRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow,
      ]}
    >
      {items.map((it, i) => (
        <View key={it.label} style={styles.pillItem}>
          <Text style={[styles.pillValue, { color: it.color || colors.text }]}>
            {it.value}
          </Text>
          <Text style={[styles.pillLabel, { color: colors.textMuted }]}>
            {it.label}
          </Text>
          {i < items.length - 1 ? (
            <View style={[styles.pillDivider, { backgroundColor: colors.border }]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderWrap: {
    paddingHorizontal: TOKENS.space.xl,
    paddingTop: TOKENS.space.md,
    paddingBottom: TOKENS.space.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: TOKENS.font.h2,
    fontWeight: "800",
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: TOKENS.font.body,
    marginTop: 6,
    lineHeight: 19,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  groupLabel: {
    fontSize: TOKENS.font.label,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: TOKENS.radius.lg,
    padding: TOKENS.space.lg,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: TOKENS.radius.lg,
    padding: TOKENS.space.lg,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: TOKENS.font.body,
    fontWeight: "700",
  },
  statSub: {
    fontSize: TOKENS.font.label,
    marginTop: 2,
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: TOKENS.radius.lg,
    padding: TOKENS.space.md,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { flex: 1 },
  quickTitle: {
    fontSize: TOKENS.font.body,
    fontWeight: "800",
  },
  quickSub: {
    fontSize: TOKENS.font.label,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: TOKENS.radius.lg,
    padding: TOKENS.space.lg,
    marginBottom: 12,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1 },
  actionTitle: {
    fontSize: TOKENS.font.title,
    fontWeight: "800",
  },
  actionSub: {
    fontSize: TOKENS.font.label,
    marginTop: 3,
    lineHeight: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    gap: 16,
  },
  detailLabel: {
    fontSize: TOKENS.font.body,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: TOKENS.font.body,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  scanFrame: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scanInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.04)",
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
  },
  scanLine: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: TOKENS.radius.md,
    paddingVertical: 15,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: TOKENS.font.body,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: TOKENS.radius.md,
    borderWidth: 1.5,
    paddingVertical: 13,
  },
  outlineBtnText: {
    fontSize: TOKENS.font.body,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: TOKENS.radius.lg,
    paddingVertical: 14,
  },
  pillItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pillValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  pillLabel: {
    fontSize: TOKENS.font.micro,
    marginTop: 3,
    fontWeight: "600",
  },
  pillDivider: {
    position: "absolute",
    right: 0,
    top: "20%",
    height: "60%",
    width: StyleSheet.hairlineWidth,
  },
});
