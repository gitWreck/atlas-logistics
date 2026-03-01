import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ReportIssueModal({
  visible,
  onClose,
  onSubmit,
  isPickup,
}) {
  const [selectedReason, setSelectedReason] = useState(null);

  // Dynamically change reasons based on whether they are picking up or dropping off
  const reasons = isPickup
    ? [
        {
          id: "SENDER_NOT_HOME",
          label: "Sender not home",
          icon: "door-closed",
        },
        {
          id: "PACKAGE_NOT_READY",
          label: "Package not ready",
          icon: "box-open",
        },
        {
          id: "WRONG_ADDRESS",
          label: "Cannot locate address",
          icon: "map-signs",
        },
      ]
    : [
        {
          id: "CUSTOMER_NOT_HOME",
          label: "Customer not home",
          icon: "door-closed",
        },
        {
          id: "WRONG_ADDRESS",
          label: "Cannot locate address",
          icon: "map-signs",
        },
        {
          id: "RECIPIENT_REFUSED",
          label: "Recipient refused package",
          icon: "hand-paper",
        },
        {
          id: "DAMAGED_IN_TRANSIT",
          label: "Package damaged",
          icon: "car-crash",
        },
      ];

  const handleSubmit = () => {
    if (selectedReason) {
      const reasonText = reasons.find((r) => r.id === selectedReason)?.label;
      onSubmit(selectedReason, reasonText);
      setSelectedReason(null); // Reset for next time
    }
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
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Report Issue</Text>
              <Text style={styles.subtitle}>Why is this shipment failing?</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listContainer}>
            {reasons.map((reason) => {
              const isActive = selectedReason === reason.id;
              return (
                <TouchableOpacity
                  key={reason.id}
                  style={[styles.reasonRow, isActive && styles.reasonRowActive]}
                  onPress={() => setSelectedReason(reason.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      isActive && styles.iconCircleActive,
                    ]}
                  >
                    <FontAwesome5
                      name={reason.icon}
                      size={14}
                      color={isActive ? "#ef4444" : "#64748b"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      isActive && styles.reasonTextActive,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {isActive && (
                    <FontAwesome5
                      name="check-circle"
                      size={18}
                      color="#ef4444"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              !selectedReason && styles.submitBtnDisabled,
            ]}
            disabled={!selectedReason}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>Submit Report</Text>
          </TouchableOpacity>
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
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  closeBtn: { padding: 8, backgroundColor: "#f1f5f9", borderRadius: 20 },
  listContainer: { marginBottom: 20 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  reasonRowActive: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconCircleActive: { backgroundColor: "#fee2e2" },
  reasonText: { flex: 1, fontSize: 15, color: "#334155", fontWeight: "500" },
  reasonTextActive: { color: "#991b1b", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: "#fca5a5" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
