import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ShipmentActionModal({
  visible,
  onClose,
  shipment,
  onAction,
}) {
  if (!shipment) return null;

  const ACTION_BUTTONS = [
    { label: "Unload", action: "UNLOAD", icon: "arrow-down", color: "#f59e0b" }, // Orange
    { label: "Load", action: "LOAD", icon: "arrow-up", color: "#3b82f6" }, // Blue
    {
      label: "Mark Out for Delivery",
      action: "OUT_FOR_DELIVERY",
      icon: "shipping-fast",
      color: "#10b981",
    }, // Green
    {
      label: "Mark Delivered",
      action: "DELIVERED",
      icon: "check-circle",
      color: "#059669",
    }, // Dark Green
  ];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Transparent backdrop to close on tap */}
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

          {/* Action Grid */}
          <View style={styles.actionsContainer}>
            {ACTION_BUTTONS.map((btn) => (
              <TouchableOpacity
                key={btn.action}
                style={[styles.actionBtn, { borderColor: btn.color }]}
                onPress={() => {
                  onAction(btn.action);
                  onClose();
                }}
              >
                <View
                  style={[styles.iconCircle, { backgroundColor: btn.color }]}
                >
                  <FontAwesome5 name={btn.icon} size={20} color="#fff" />
                </View>
                <Text style={[styles.btnText, { color: btn.color }]}>
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
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
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  status: { fontSize: 12, fontWeight: "600", color: "#3b82f6", marginTop: 4 },
  closeBtn: {
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
  },
  actionsContainer: {
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
