import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ScanSuccessModal({
  visible,
  payload,
  countdown,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <FontAwesome5 name="check" size={24} color="#fff" />
          </View>

          <Text style={styles.title}>Success</Text>
          <Text style={styles.message}>
            {payload?.message || "Package processed successfully."}
          </Text>

          <View style={styles.metaBox}>
            <MetaRow label="Package" value={payload?.barcode || "-"} />
            <MetaRow label="Status" value={payload?.packageStatus || "-"} />

            {!!payload?.quantity && (
              <MetaRow label="Quantity" value={payload.quantity} />
            )}

            <MetaRow
              label="Source"
              value={payload?.source === "manual" ? "Manual Input" : "Scan"}
            />
          </View>

          <Text style={styles.countdown}>Closing in {countdown}s</Text>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>Close Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function MetaRow({ label, value }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
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
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
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
  countdown: {
    marginTop: 16,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },
  closeButton: {
    marginTop: 14,
    width: "100%",
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
