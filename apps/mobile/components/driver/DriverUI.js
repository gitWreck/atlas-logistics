import React, { useMemo } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "../../contexts/ThemeContext";
import { dateFromKey, formatSelectedDate, manilaDateKey } from "./driverData";
import { PersonAvatar } from "../chat/ChatComponents";

export function DriverCard({ children, style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.dashboardSurface,
          borderColor: colors.dashboardBorder,
          shadowColor: colors.dashboardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function DriverAvatar({ user, size = 64 }) {
  const photoURL = user?.photoURL || user?.profilePhotoURL || user?.profilePicture || user?.avatarUrl;
  const name = user?.name || user?.fullName || user?.displayName || "Driver";
  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return <PersonAvatar name={name} size={size} />;
}

export function DriverPageHeader({ title, onBack, rightIcon, onRightPress, subtitle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pageHeader, { backgroundColor: colors.dashboardBg }]}>
      <View style={styles.headerSide}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.headerButton} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        {rightIcon ? (
          <TouchableOpacity onPress={onRightPress} style={styles.headerButton} accessibilityLabel={rightIcon}>
            <Feather name={rightIcon} size={21} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function ProgressRing({ percentage, size = 56, strokeWidth = 6 }) {
  const { colors } = useTheme();
  const value = Math.max(0, Math.min(100, Number(percentage || 0)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.neutralSoft}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.success}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value / 100)}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.ringText, { color: colors.text }]}>{Math.round(value)}%</Text>
    </View>
  );
}

export function DateSelector({ value, onPress, compact = false }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.dateSelector,
        compact && styles.dateSelectorCompact,
        { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder },
      ]}
      accessibilityLabel={`Select date. ${formatSelectedDate(value)}`}
    >
      <Feather name="calendar" size={17} color={colors.primary} />
      <Text style={[styles.dateText, { color: colors.text }]} numberOfLines={1}>
        {formatSelectedDate(value)}
      </Text>
      <Feather name="chevron-down" size={17} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function DriverDatePicker({ visible, value, onChange, onClose }) {
  const { colors } = useTheme();
  const selected = dateFromKey(value);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected);
    date.setDate(date.getDate() + index - 3);
    return date;
  }), [value]);

  const shift = (amount) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + amount);
    onChange(manilaDateKey(next));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.dateModal, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.modalTitleRow}>
            <View>
              <Text style={[styles.modalEyebrow, { color: colors.primary }]}>DELIVERY DATE</Text>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{formatSelectedDate(value)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateDays}>
            {dates.map((date) => {
              const key = manilaDateKey(date);
              const active = key === value;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => onChange(key)}
                  style={[styles.dayButton, { backgroundColor: active ? colors.primary : colors.cardMuted }]}
                >
                  <Text style={[styles.dayName, { color: active ? colors.onPrimary : colors.textMuted }]}>
                    {new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date)}
                  </Text>
                  <Text style={[styles.dayNumber, { color: active ? colors.onPrimary : colors.text }]}>{date.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.shiftButton, { borderColor: colors.border }]} onPress={() => shift(-1)}>
              <Feather name="chevron-left" size={18} color={colors.text} />
              <Text style={[styles.shiftText, { color: colors.text }]}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(manilaDateKey())}>
              <Text style={[styles.todayText, { color: colors.primary }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shiftButton, { borderColor: colors.border }]} onPress={() => shift(1)}>
              <Text style={[styles.shiftText, { color: colors.text }]}>Next</Text>
              <Feather name="chevron-right" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function EmptyDriverState({ icon = "inbox", title, message }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={25} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 2,
  },
  pageHeader: { minHeight: 62, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
  headerSide: { width: 44, alignItems: "flex-start" },
  headerSideRight: { alignItems: "flex-end" },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center", minWidth: 0 },
  headerTitle: { fontSize: 19, fontWeight: "800" },
  headerSubtitle: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  ringText: { fontSize: 11, fontWeight: "800" },
  dateSelector: {
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateSelectorCompact: { minHeight: 40, alignSelf: "center", paddingHorizontal: 13 },
  dateText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(2, 8, 23, 0.5)", justifyContent: "center", padding: 18 },
  dateModal: { borderWidth: 1, borderRadius: 20, padding: 18 },
  modalTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  modalTitle: { marginTop: 4, fontSize: 20, fontWeight: "800" },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dateDays: { flexDirection: "row", justifyContent: "space-between", gap: 5, marginTop: 20 },
  dayButton: { flex: 1, minWidth: 36, height: 58, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dayName: { fontSize: 10, fontWeight: "700" },
  dayNumber: { marginTop: 4, fontSize: 16, fontWeight: "800" },
  modalActions: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shiftButton: { height: 38, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  shiftText: { fontSize: 12, fontWeight: "700" },
  todayText: { fontSize: 13, fontWeight: "800" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 34, paddingHorizontal: 24 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 12, fontSize: 15, fontWeight: "800", textAlign: "center" },
  emptyMessage: { marginTop: 5, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
