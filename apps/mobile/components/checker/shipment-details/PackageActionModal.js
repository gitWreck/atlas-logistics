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

export default function PackageActionModal({
  visible,
  onClose,
  count,
  onAction,
}) {
  const ACTIONS = [
    { label: "Received", mode: "RECEIVED", icon: "box", color: "#64748b" }, // Grey
    { label: "Load", mode: "LOADED", icon: "arrow-up", color: "#3b82f6" }, // Blue
    { label: "Unload", mode: "UNLOAD", icon: "arrow-down", color: "#f59e0b" }, // Orange
    {
      label: "Arrived",
      mode: "ARRIVED",
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
          <View style={styles.header}>
            <Text style={styles.title}>Update Status</Text>
            {count > 1 ? (
              <Text style={styles.subtitle}>Updating {count} packages</Text>
            ) : (
              <Text style={styles.subtitle}>Select an action</Text>
            )}
          </View>

          <View style={styles.grid}>
            {ACTIONS.map((btn) => (
              <TouchableOpacity
                key={btn.mode}
                style={[styles.btn, { borderColor: btn.color }]}
                onPress={() => {
                  onAction(btn.mode);
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
  backdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
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
  btnText: { fontWeight: "600", fontSize: 14 },
});
