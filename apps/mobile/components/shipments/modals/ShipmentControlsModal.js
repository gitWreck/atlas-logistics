import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ShipmentControlsModal({
  visible,
  onClose,
  onBulkLoad,
  onBulkReceive,
  onFinalize,
  tripStatus,
}) {
  const [remarks, setRemarks] = useState("");
  const isReceiving = tripStatus === "IN_TRANSIT" || tripStatus === "ARRIVED";

  // Reset remarks when modal opens
  useEffect(() => {
    if (visible) setRemarks("");
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Bulk Actions</Text>
              <Text style={styles.subtitle}>
                Update status and add trip notes
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}
              onPress={() => {
                onClose();
                setTimeout(() => onBulkLoad(remarks), 300); // Pass remarks to bulk
              }}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="arrow-up" size={16} color="#3b82f6" />
              </View>
              <Text style={styles.btnText}>Set All Loaded (Outbound)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
              onPress={() => {
                onClose();
                setTimeout(() => onBulkReceive(remarks), 300);
              }}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="warehouse" size={14} color="#10b981" />
              </View>
              <Text style={styles.btnText}>Set All Received (Inbound)</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#6366f1" }]}
              onPress={() => {
                onClose();
                setTimeout(() => onFinalize(remarks), 300); // Pass remarks to finalize
              }}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="check-double" size={16} color="#6366f1" />
              </View>
              <Text style={styles.btnText}>
                {isReceiving ? "Mark Trip as Arrived" : "Mark Trip as Loaded"}
              </Text>
            </TouchableOpacity>

            {/* Remarks Input Section */}
            <Text style={styles.label}>Trip / Bulk Remarks (Optional)</Text>
            <TextInput
              style={styles.remarksInput}
              placeholder="e.g., Seal #12345, 2 boxes wet, etc."
              placeholderTextColor="#94a3b8"
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  remarksInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 80,
    textAlignVertical: "top",
    // marginBottom: 20,
  },
  closeBtn: { padding: 8, backgroundColor: "#f1f5f9", borderRadius: 20 },
  actionColumn: { gap: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  separator: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 8 },
});
