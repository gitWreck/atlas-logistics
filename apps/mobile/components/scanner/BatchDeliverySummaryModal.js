import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function BatchDeliverySummaryModal({
  visible,
  customerName = "",
  shipmentLabel = "",
  pieces = [],
  eyebrow = "Delivered items",
  completeLabel = "Complete scan & take POD",
  accentColor = "#2563eb",
  iconName = "check-circle",
  onRemovePiece,
  onCompleteScan,
  onCancel,
}) {
  const { colors } = useTheme();
  const total = pieces.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: accentColor }]}>
                {eyebrow}
              </Text>
              <Text style={[styles.title, { color: colors.text }]}>
                {customerName || "Customer"}
              </Text>
              {!!shipmentLabel && (
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {shipmentLabel}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onCancel}
              style={[
                styles.closeButton,
                { backgroundColor: colors.cardMuted },
              ]}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="times" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            {pieces.map((piece) => (
              <View
                key={piece.packageId}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  <FontAwesome5 name={iconName} size={14} color={accentColor} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      {piece.label}
                    </Text>
                    <Text style={[styles.rowCode, { color: colors.textMuted }]}>
                      {piece.packageId}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => onRemovePiece(piece.packageId)}
                  style={styles.removeBtn}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="times" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.summaryRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
              Total scanned:
            </Text>
            <Text style={[styles.summaryValue, { color: accentColor }]}>
              {total} piece{total === 1 ? "" : "s"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: accentColor },
              total === 0 && styles.disabled,
            ]}
            onPress={onCompleteScan}
            disabled={total === 0}
            activeOpacity={0.86}
          >
            <FontAwesome5
              name={
                completeLabel.toLowerCase().includes("pod") ? "camera" : "check"
              }
              size={14}
              color="#ffffff"
            />
            <Text style={styles.primaryBtnText}>{completeLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
              Scan more pieces
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "78%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    maxHeight: 260,
  },
  listContent: {
    gap: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  rowCode: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.55,
  },
});
