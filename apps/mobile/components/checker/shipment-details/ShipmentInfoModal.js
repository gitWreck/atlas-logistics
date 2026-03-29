import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ShipmentInfoModal({
  visible,
  data,
  onClose,
  onDetails,
}) {
  if (!data) return null;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name="info-circle" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.title}>Shipment Info</Text>
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="Tracking #" value={data.trackingNumber} bold />
            <InfoRow label="Status" value={data.status || "N/A"} isStatus />
            <InfoRow
              label="Route"
              value={`${data.originCode} ➔ ${data.destinationCode}`}
            />
            <InfoRow label="Sender" value={data.sender?.name || "N/A"} />
            <InfoRow label="Recipient" value={data.recipient?.name || "N/A"} />
            <InfoRow
              label="Total Items"
              value={`${data.packageBarcodes?.length || 0} packages`}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Scan Next</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailBtn} onPress={onDetails}>
              <Text style={styles.detailBtnText}>View Full Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const InfoRow = ({ label, value, bold, isStatus }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text
      style={[
        styles.value,
        bold && styles.bold,
        isStatus && styles.statusValue,
      ]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  content: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  infoGrid: { gap: 12, marginBottom: 24 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  value: { color: "#1e293b", fontSize: 14, fontWeight: "500" },
  bold: { fontWeight: "800", color: "#0f172a" },
  statusValue: {
    color: "#2563eb",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  footer: { gap: 10 },
  detailBtn: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  detailBtnText: { color: "#fff", fontWeight: "700" },
  closeBtn: { padding: 12, alignItems: "center" },
  closeBtnText: { color: "#64748b", fontWeight: "600" },
});
