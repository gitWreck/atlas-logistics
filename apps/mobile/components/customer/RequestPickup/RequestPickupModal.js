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
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { auth } from "../../../firebase";

// We use the logic from your Web InputGroup but adapted for React Native
import InputGroupMobile from "./InputGroupMobile";
import ItemSectionMobile from "./ItemSectionMobile";

import { useAuth } from "../../../contexts/AuthContext";
import MapPickupModal from "./MapPickupModal";

const createEmptyParty = () => ({
  uid: null,
  userId: null,
  name: "",
  phone: "",
  unit: "",
  street: "",
  barangay: "",
  province: "",
  city: "",
});

const createEmptyItem = () => ({
  description: "",
  quantity: "",
  packagingType: "Box",
});

export default function RequestPickupModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  userData,
}) {
  const { user } = useAuth();

  const getSenderFromProfile = (profile = userData || user || {}) => ({
    uid: profile?.uid || profile?.id || auth.currentUser?.uid || null,
    userId:
      profile?.userId ||
      profile?.publicId ||
      profile?.userCode ||
      profile?.driverCode ||
      null,
    name: profile?.name || profile?.displayName || "",
    phone: profile?.phoneNumber || profile?.phone || "",
    unit: profile?.address?.unit || "",
    street: profile?.address?.street || "",
    barangay: profile?.address?.barangay || "",
    province: profile?.address?.province || "",
    city: profile?.address?.city || "",
  });

  const [sender, setSender] = useState(createEmptyParty);

  const [recipient, setRecipient] = useState(createEmptyParty);

  const [items, setItems] = useState(() => [createEmptyItem()]);
  const [remarks, setRemarks] = useState("");

  const [location, setLocation] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Auto-fill Sender with User Data on open
  useEffect(() => {
    if (visible) {
      setSender(getSenderFromProfile());
    } else {
      setRecipient(createEmptyParty());
      setItems([createEmptyItem()]);
      setRemarks("");
      setLocation(null);
    }
  }, [visible, userData, user]);

  const handleAddItem = () => {
    setItems([...items, createEmptyItem()]);
  };

  const updateItem = (index, field, val) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: val } : item,
      ),
    );
  };

  const handleFormSubmit = () => {
    const hasSender =
      sender.name &&
      sender.phone &&
      sender.street &&
      sender.province &&
      sender.city;
    const hasRecipient =
      recipient.name &&
      recipient.phone &&
      recipient.street &&
      recipient.province &&
      recipient.city;
    const hasValidItems = items.every(
      (item) => item.description && Number(item.quantity) > 0,
    );

    if (!hasSender || !hasRecipient) {
      Alert.alert(
        "Missing Details",
        "Please complete sender and recipient details before submitting.",
      );
      return;
    }

    if (!hasValidItems) {
      Alert.alert(
        "Invalid Items",
        "Please add a description and quantity for each package item.",
      );
      return;
    }

    onSubmit({
      sender,
      recipient,
      items,
      remarks,
      location,
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
                  setItems((currentItems) =>
                    currentItems.map((item, itemIndex) =>
                      itemIndex === idx
                        ? { ...item, [tag]: !item[tag] }
                        : item,
                    ),
                  );
                }}
              />

              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>
                  Exact Pickup Coordinates
                </Text>

                {/* Open Map Button */}
                <TouchableOpacity
                  style={[
                    styles.input,
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: location ? "#ecfeff" : "#f8fafc",
                      borderColor: location ? "#06b6d4" : "#e2e8f0",
                      marginTop: 10,
                      marginBottom: 0,
                      paddingVertical: 16,
                    },
                  ]}
                  onPress={() => setShowMapModal(true)}
                >
                  <FontAwesome5
                    name={location ? "map-marked-alt" : "map-marker-alt"}
                    size={16}
                    color={location ? "#0891b2" : "#64748b"}
                    style={{ marginRight: 10 }}
                  />
                  <Text
                    style={{
                      color: location ? "#0891b2" : "#64748b",
                      fontWeight: "700",
                    }}
                  >
                    {location
                      ? "Location Pinned (Tap to Edit)"
                      : "Open Map to Pin Location"}
                  </Text>
                </TouchableOpacity>

                {/* Optional: Add the auto-fetch GPS button back below it if you still want a 1-click option without opening the map */}
              </View>

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
      <MapPickupModal
        visible={showMapModal}
        initialLocation={location}
        onClose={() => setShowMapModal(false)}
        onConfirm={(newLoc) => setLocation(newLoc)}
      />
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
  mapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
