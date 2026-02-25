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

export default function TripFilterModal({
  visible,
  onClose,
  activeFilter,
  onApplyFilter,
}) {
  const FILTER_OPTIONS = [
    { label: "Show All", value: "ALL", icon: "list", color: "#64748b" }, // Slate
    { label: "Loaded", value: "LOADED", icon: "arrow-up", color: "#3b82f6" }, // Blue
    {
      label: "In Transit",
      value: "IN_TRANSIT",
      icon: "truck",
      color: "#f59e0b",
    }, // Orange
    {
      label: "Arrived",
      value: "ARRIVED",
      icon: "map-marker-alt",
      color: "#10b981",
    }, // Green
  ];

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
              <Text style={styles.title}>Filter Trips</Text>
              <Text style={styles.subtitle}>Select a specific trip status</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Quadrant Grid */}
          <View style={styles.grid}>
            {FILTER_OPTIONS.map((btn) => {
              const isActive = activeFilter === btn.value;
              return (
                <TouchableOpacity
                  key={btn.value}
                  // Highlight the border and add a light background tint if active
                  style={[
                    styles.btn,
                    {
                      borderColor: isActive ? btn.color : "#e2e8f0",
                      backgroundColor: isActive ? `${btn.color}10` : "#fff", // '10' adds 10% opacity in hex
                    },
                  ]}
                  onPress={() => {
                    onApplyFilter(btn.value);
                    onClose();
                  }}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isActive ? btn.color : "#94a3b8" }, // Grey out icon if not active
                    ]}
                  >
                    <FontAwesome5 name={btn.icon} size={16} color="#fff" />
                  </View>
                  <Text
                    style={[
                      styles.btnText,
                      { color: isActive ? btn.color : "#64748b" },
                    ]}
                  >
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  closeBtn: {
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
  },
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
    borderWidth: 1.5,
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
    flex: 1,
  },
});
