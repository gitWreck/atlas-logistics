import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function ScanSuccessModal({
  visible,
  payload,
  onScanAnother,
  onDone,
  onRequestClose,
  accentColor = "#2563eb",
}) {
  const { colors } = useTheme();
  const pending = !!payload?.pendingSync;
  const alreadyScanned = payload?.resultType === "already_scanned";
  const resultColor = alreadyScanned
    ? "#d97706"
    : pending
      ? "#f59e0b"
      : "#16a34a";
  const confetti = [
    { top: 2, left: 30, color: "#f59e0b", size: 8 },
    { top: 10, left: 96, color: "#ec4899", size: 6 },
    { top: 0, left: 150, color: "#3b82f6", size: 7 },
    { top: 30, left: 8, color: "#10b981", size: 6 },
    { top: 34, left: 176, color: "#8b5cf6", size: 8 },
    { top: 58, left: 44, color: "#06b6d4", size: 6 },
    { top: 62, left: 140, color: "#f43f5e", size: 7 },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.iconArea}>
            {!pending && !alreadyScanned
              ? confetti.map((c, i) => (
                  <View
                    key={i}
                    style={[
                      styles.confetti,
                      {
                        top: c.top,
                        left: c.left,
                        width: c.size,
                        height: c.size,
                        backgroundColor: c.color,
                      },
                    ]}
                  />
                ))
              : null}
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: resultColor },
              ]}
            >
              <FontAwesome5
                name={
                  alreadyScanned
                    ? "exclamation"
                    : pending
                      ? "cloud-upload-alt"
                      : "check"
                }
                size={26}
                color="#fff"
              />
            </View>
          </View>

          <Text
            style={[
              styles.title,
              { color: alreadyScanned || pending ? "#b45309" : "#16a34a" },
            ]}
          >
            {alreadyScanned
              ? "Already scanned"
              : pending
                ? "Saved — Pending Sync"
                : payload?.successTitle || "Success!"}
          </Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {payload?.message || "Package processed successfully."}
          </Text>

          {pending ? (
            <View style={[styles.pendingBadge, { backgroundColor: colors.warningSoft }]}>
              <FontAwesome5 name="cloud-upload-alt" size={12} color="#b45309" />
              <Text style={[styles.pendingText, { color: colors.warning }]}>
                Will sync automatically when you are back online.
              </Text>
            </View>
          ) : null}

          <View style={[styles.metaBox, { backgroundColor: colors.cardMuted }]}>
            <MetaRow label="Package" value={payload?.barcode || "-"} colors={colors} />
            <MetaRow label="Status" value={payload?.packageStatus || "-"} colors={colors} />

            {!!payload?.quantity && (
              <MetaRow label="Quantity" value={payload.quantity} colors={colors} />
            )}

            <MetaRow
              label="Source"
              value={payload?.source === "manual" ? "Manual Input" : "Scan"}
              colors={colors}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={onScanAnother}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="qrcode" size={14} color="#fff" />
            <Text style={styles.primaryButtonText}>SCAN ANOTHER</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.doneButton, { borderColor: accentColor }]}
            onPress={onDone}
            activeOpacity={0.85}
          >
            <Text style={[styles.doneButtonText, { color: accentColor }]}>
              DONE
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

function MetaRow({ label, value, colors }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  iconArea: {
    width: 200,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  confetti: {
    position: "absolute",
    borderRadius: 2,
    transform: [{ rotate: "20deg" }],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#16a34a",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    width: "100%",
  },
  pendingText: {
    flex: 1,
    color: "#92400e",
    fontSize: 12,
    lineHeight: 16,
  },
  metaBox: {
    width: "100%",
    marginTop: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  metaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 18,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  doneButton: {
    marginTop: 10,
    width: "100%",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
