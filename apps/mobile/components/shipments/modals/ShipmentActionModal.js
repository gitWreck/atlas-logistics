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
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { CHECKER_SHIPMENT_ACTION } from "../../constants/templates";

export default function ShipmentActionModal({
  visible,
  onClose,
  shipment,
  onAction,
}) {
  const [remarks, setRemarks] = useState("");

  // Clear the input field every time the modal opens
  useEffect(() => {
    if (visible) {
      setRemarks("");
    }
  }, [visible]);

  if (!shipment) return null;

  const handleActionPress = (actionCode) => {
    // Pass both the action and the newly typed remarks back to the parent
    onAction(actionCode, remarks?.trim());
    onClose();
  };

  // Safely grab the most recent remark (fallback to "None" if empty)
  const recentRemarks = shipment.remarks || "No recent remarks.";

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Update Shipment</Text>
              <Text style={styles.subtitle}>ID: {shipment.id}</Text>
              <Text style={styles.status}>
                Current Status: {shipment.status}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Quadrant Action Grid */}
          <View style={styles.grid}>
            {CHECKER_SHIPMENT_ACTION.map((btn) => (
              <TouchableOpacity
                key={btn.action}
                style={[styles.btn, { borderColor: btn.color }]}
                onPress={() => handleActionPress(btn.action)}
              >
                <View
                  style={[styles.iconCircle, { backgroundColor: btn.color }]}
                >
                  <FontAwesome5 name={btn.icon} size={14} color="#fff" />
                </View>
                <Text style={[styles.btnText, { color: btn.color }]}>
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ✅ NEW: Recent Remarks Display */}
          <View style={styles.recentRemarksBox}>
            <Text style={styles.remarksLabel}>Recent Notes:</Text>
            <Text style={styles.recentRemarksText} numberOfLines={2}>
              {recentRemarks}
            </Text>
          </View>

          {/* ✅ NEW: Remarks Input */}
          <TextInput
            style={styles.remarksInput}
            placeholder="Add an optional note (e.g., Damaged box, Wrong hub)"
            placeholderTextColor="#94a3b8"
            value={remarks}
            onChangeText={setRemarks}
            multiline={true}
            maxLength={150} // Keep it concise for the database
          />
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  status: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
    marginTop: 4,
    textTransform: "uppercase",
  },
  closeBtn: { padding: 8, backgroundColor: "#f1f5f9", borderRadius: 20 },

  // ✅ Remarks Styles
  recentRemarksBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#cbd5e1",
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  recentRemarksText: { fontSize: 13, color: "#334155", fontStyle: "italic" },
  remarksInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    minHeight: 60,
    textAlignVertical: "top",
    // marginBottom: 20,
  },

  // Grid Styles
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  btn: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  btnText: { fontWeight: "600", fontSize: 13, flex: 1 },
});
