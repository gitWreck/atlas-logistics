import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { signOut } from "firebase/auth";

import { auth } from "../../firebase";
import { COLORS } from "../../components/constants/theme";
import AtlasInput from "../../components/ui/AtlasInput";
import GradientButton from "../../components/ui/figma/GradientButton";

export default function CustomerDashboard() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [trackedShipments, setTrackedShipments] = useState([]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const openAddModal = () => {
    setTrackingNumber("");
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
  };

  const handleAddTracking = () => {
    if (!trackingNumber) {
      return;
    }

    // For now, just add to local list to visualize.
    setTrackedShipments((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${trackingNumber}`,
        trackingNumber: trackingNumber.trim(),
      },
    ]);

    setAddModalVisible(false);
    setTrackingNumber("");
    // Backend validation + Firestore linking will be wired here later.
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.headerTitle}>Customer Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Your shipments and activity will appear here.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={20} color={COLORS.logout} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Section: Tracked Shipments */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My tracked shipments</Text>
        </View>

        {trackedShipments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              You haven’t added any tracking numbers yet.
            </Text>
            <Text style={styles.emptyTextMuted}>
              Use “Add tracking” to link a shipment to your dashboard.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {trackedShipments.map((item) => (
              <View key={item.id} style={styles.shipmentCard}>
                <Text style={styles.trackingLabel}>Tracking number</Text>
                <Text style={styles.trackingValue}>{item.trackingNumber}</Text>
                <Text style={styles.trackingHint}>
                  Details and status will be shown here later.
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Floating Add Tracking FAB (gradient, aligned with theme) */}
      <TouchableOpacity style={styles.fabWrapper} onPress={openAddModal} activeOpacity={0.85}>
        <LinearGradient
          colors={["#042C83", "#07B9F4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fab}
        >
          <FontAwesome5 name="plus" size={18} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Tracking Number Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={addModalVisible}
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAddModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a tracking number</Text>
            <Text style={styles.modalSubtitle}>
              Enter a tracking number to link an existing shipment to your
              account.
            </Text>

            <View style={styles.modalInputWrapper}>
              <AtlasInput
                label="Tracking Number"
                placeholder="e.g. ATLAS-123456"
                value={trackingNumber}
                onChangeText={setTrackingNumber}
              />
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeAddModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <View style={styles.modalPrimaryBtnWrapper}>
                <GradientButton
                  title="Add"
                  onPress={handleAddTracking}
                  disabled={!trackingNumber}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#64748b",
    fontSize: 13,
  },
  logoutBtn: {
    marginLeft: 16,
    padding: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  emptyTextMuted: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  shipmentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  trackingLabel: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  trackingValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  trackingHint: {
    fontSize: 12,
    color: "#64748b",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  modalInputWrapper: {
    marginBottom: 16,
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    fontSize: 13,
    color: "#64748b",
  },
  modalPrimaryBtnWrapper: {
    flex: 1,
  },
  fabWrapper: {
    position: "absolute",
    right: 24,
    bottom: 32,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});

