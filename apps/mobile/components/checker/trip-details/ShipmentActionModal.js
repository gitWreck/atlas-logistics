import React, { useState } from "react";
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
      label: "Arrived",
      action: "ARRIVED",
      icon: "warehouse", // Or "map-marker-alt"
      color: "#8b5cf6", // Purple (distinct from the delivery steps)
    },
    {
      label: "Out for Delivery",
      action: "OUT_FOR_DELIVERY",
      icon: "shipping-fast",
      color: "#10b981",
    }, // Green
    {
      label: "Delivered",
      action: "DELIVERED",
      icon: "check-circle",
      color: "#059669",
    }, // Dark Green
  ];

  const handleActionPress = (actionCode) => {
    onAction(actionCode, { sendText: true });
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
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

          {/* Quadrant Action Grid (Matched to PackageActionModal Style) */}
          <View style={styles.grid}>
            {ACTION_BUTTONS.map((btn) => (
              <TouchableOpacity
                key={btn.action}
                style={[styles.btn, { borderColor: btn.color }]}
                onPress={() => handleActionPress(btn.action)}
              >
                <View
                  style={[styles.iconCircle, { backgroundColor: btn.color }]}
                >
                  <FontAwesome5 name={btn.icon} size={16} color="#fff" />
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
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  status: { fontSize: 12, fontWeight: "600", color: "#3b82f6", marginTop: 4 },
  closeBtn: {
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toggleTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleIcon: {
    marginRight: 10,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
  },

  // Copied & Adjusted Grid Styles
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  btnText: {
    fontWeight: "600",
    fontSize: 13,
    flex: 1, // Ensures long text wraps instead of breaking the box
  },
});
