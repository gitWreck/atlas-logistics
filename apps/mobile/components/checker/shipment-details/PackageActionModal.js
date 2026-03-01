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

export default function PackageActionModal({
  visible,
  onClose,
  count,
  onAction,
}) {
  const [remarks, setRemarks] = useState("");

  // Clear remarks when modal opens
  useEffect(() => {
    if (visible) setRemarks("");
  }, [visible]);

  const ACTIONS = [
    {
      label: "Load to Truck",
      mode: "LOADED",
      icon: "arrow-up",
      color: "#3b82f6",
    },
    {
      label: "Receive at Hub",
      mode: "RECEIVED",
      icon: "warehouse",
      color: "#10b981",
    },
    {
      label: "Mark Missing",
      mode: "MISSING",
      icon: "exclamation-triangle",
      color: "#ef4444",
    },
    { label: "Damaged", mode: "DAMAGED", icon: "pills", color: "#f59e0b" }, // Using pills or box-open
  ];

  const handlePress = (mode) => {
    onAction(mode, remarks.trim());
    onClose();
  };

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
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Update Package Status</Text>
              <Text style={styles.subtitle}>
                {count > 1
                  ? `Updating ${count} selected items`
                  : "Select an action for this item"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Remarks Input */}
          <Text style={styles.label}>Notes / Remarks</Text>
          <TextInput
            style={styles.remarksInput}
            placeholder="Add an optional note..."
            placeholderTextColor="#94a3b8"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={2}
          />

          <View style={styles.grid}>
            {ACTIONS.map((btn) => (
              <TouchableOpacity
                key={btn.mode}
                style={[styles.btn, { borderColor: btn.color }]}
                onPress={() => handlePress(btn.mode)}
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
    marginBottom: 20,
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 4, fontSize: 13 },

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
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 20,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  btn: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  btnText: { fontWeight: "700", fontSize: 13, flex: 1 },
});
