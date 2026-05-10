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
import { useTheme } from "../../contexts/ThemeContext";

// ✅ 1. Add `options` to your props
export default function TripFilterModal({
  visible,
  onClose,
  activeFilter,
  onApplyFilter,
  options,
}) {
  const { colors } = useTheme();

  // ✅ 2. Setup a default fallback (so the Driver app doesn't break)
  const defaultOptions = [
    { label: "Show All", value: "ALL", icon: "list", color: "#64748b" },
    { label: "Loaded", value: "LOADED", icon: "arrow-up", color: "#3b82f6" },
    {
      label: "In Transit",
      value: "IN_TRANSIT",
      icon: "truck",
      color: "#f59e0b",
    },
    {
      label: "Arrived",
      value: "ARRIVED",
      icon: "map-marker-alt",
      color: "#10b981",
    },
  ];

  // Use the passed options, or default to the Driver ones
  const activeOptions = options || defaultOptions;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                Filter Trips
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Select a specific trip status
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.cardMuted }]}
            >
              <FontAwesome5 name="times" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Quadrant Grid */}
          <View style={styles.grid}>
            {/* ✅ 3. Map over `activeOptions` instead of the hardcoded list */}
            {activeOptions.map((btn) => {
              const isActive = activeFilter === btn.value;
              return (
                <TouchableOpacity
                  key={btn.value}
                  style={[
                    styles.btn,
                    {
                      borderColor: isActive ? btn.color : colors.border,
                      backgroundColor: isActive
                        ? `${btn.color}10`
                        : colors.surface,
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
                      {
                        backgroundColor: isActive
                          ? btn.color
                          : colors.textMuted,
                      },
                    ]}
                  >
                    <FontAwesome5 name={btn.icon} size={16} color="#fff" />
                  </View>
                  <Text
                    style={[
                      styles.btnText,
                      { color: isActive ? btn.color : colors.textMuted },
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

// ... Keep all your existing StyleSheet styles exactly the same ...
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  closeBtn: { padding: 8, backgroundColor: "#f1f5f9", borderRadius: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
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
  btnText: { fontWeight: "600", fontSize: 13, flex: 1 },
});
