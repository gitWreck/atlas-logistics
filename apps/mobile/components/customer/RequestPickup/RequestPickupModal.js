import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { auth } from "../../../firebase";

// We use the logic from your Web InputGroup but adapted for React Native
import InputGroupMobile from "./InputGroupMobile";
import ItemSectionMobile from "./ItemSectionMobile";

import { useAuth } from "../../../contexts/AuthContext";

export default function RequestPickupModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  userData,
}) {
  const { user } = useAuth();

  // Initialize Sender with logged-in user info if available
  const [sender, setSender] = useState({
    name: user.name,
    phone: user.phoneNumber,
    unit: user.address?.unit || "",
    street: user.address?.street || "",
    barangay: user.address?.barangay || "",
    province: user.address?.province || "",
    city: user.address?.city || "",
  });

  const [recipient, setRecipient] = useState({
    name: "",
    phone: "",
    unit: "",
    street: "",
    barangay: "",
    province: "",
    city: "",
  });

  const [items, setItems] = useState([
    { description: "", quantity: "", packaging: "Box" },
  ]);
  const [remarks, setRemarks] = useState("");

  // Auto-fill Sender with User Data on open
  useEffect(() => {
    if (visible && userData) {
      setSender({
        name: userData.name || "",
        phone: userData.phoneNumber || "",
        unit: userData.address?.unit || "",
        street: userData.address?.street || "",
        barangay: userData.address?.barangay || "",
        province: userData.address?.province || "",
        city: userData.address?.city || "",
      });
    }
  }, [visible, userData]);

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: "", packaging: "Box" }]);
  };

  const updateItem = (index, field, val) => {
    const newItems = [...items];
    newItems[index][field] = val;
    setItems(newItems);
  };

  const handleFormSubmit = () => {
    onSubmit({
      sender,
      recipient,
      items,
      remarks,
      timestamp: new Date().toISOString(),
    });
  };

  // console.log("user data: ", user);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Shipment Request</Text>
              <Text style={styles.subtitle}>
                Fill in details to request a pickup
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>
              {/* SENDER SECTION (Auto-fills from User Profile) */}
              <InputGroupMobile
                label="Sender"
                values={sender}
                onChange={setSender}
                color="blue"
                user={auth.currentUser}
                userData={userData}
              />

              {/* RECIPIENT SECTION (Uses Search/Suggestions) */}
              <InputGroupMobile
                label="Recipient"
                values={recipient}
                onChange={setRecipient}
                color="emerald"
                user={auth.currentUser}
              />

              <ItemSectionMobile
                items={items}
                onAdd={handleAddItem}
                onRemove={(idx) => setItems(items.filter((_, i) => i !== idx))}
                onChange={updateItem}
                onToggleTag={(idx, tag) => {
                  const newItems = [...items];
                  newItems[idx][tag] = !newItems[idx][tag];
                  setItems(newItems);
                }}
              />

              {/* REMARKS */}
              <TextInput
                style={styles.textArea}
                placeholder="Additional Instructions (e.g., Gate code, fragile items...)"
                multiline
                numberOfLines={3}
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
          </ScrollView>

          {/* FOOTER ACTION */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                isSubmitting && styles.submitBtnDisabled,
              ]}
              onPress={handleFormSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Pickup Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "92%",
  },
  header: {
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  formScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
    gap: 20,
  },
  sectionCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
  },
  addText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    height: 80,
    textAlignVertical: "top",
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
