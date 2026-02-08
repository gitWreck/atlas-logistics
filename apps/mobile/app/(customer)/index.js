import React, { useEffect, useState } from "react";
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
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { auth, db } from "../../firebase";
import { COLORS } from "../../components/constants/theme";
import AtlasInput from "../../components/ui/AtlasInput";
import GradientButton from "../../components/ui/figma/GradientButton";
import { addTrackedShipment } from "../../components/utilities/FirebaseFunctions";

export default function CustomerDashboard() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [trackedShipments, setTrackedShipments] = useState([]);
  const [adding, setAdding] = useState(false);

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

  // Subscribe to this customer's tracked shipments in Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "trackedShipments");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() || {}),
        }));
        setTrackedShipments(items);
      },
      (error) => {
        console.error("Failed to subscribe to tracked shipments:", error);
      },
    );

    return unsubscribe;
  }, []);

  const handleAddTracking = async () => {
    const normalizedTracking = trackingNumber.trim().toUpperCase();
    if (!normalizedTracking) {
      return;
    }

    try {
      setAdding(true);

      // Delegate validation + write to Cloud Function
      await addTrackedShipment({ trackingNumber: normalizedTracking });

      setAddModalVisible(false);
      setTrackingNumber("");
    } catch (error) {
      console.error("Failed to add tracked shipment:", error);
      const code = error?.code || "";

      if (code.endsWith("already-exists")) {
        Alert.alert(
          "Already added",
          "This shipment is already in your tracked list.",
        );
      } else if (code.endsWith("not-found")) {
        Alert.alert(
          "Shipment not found",
          "We couldn't find a shipment with that tracking number. Please double-check and try again.",
        );
      } else if (code.endsWith("permission-denied")) {
        Alert.alert(
          "Not authorized",
          "You can only track shipments where your name and phone number match the sender or receiver.",
        );
      } else if (code.endsWith("invalid-argument")) {
        Alert.alert(
          "Invalid tracking number",
          "Please enter a valid tracking number and try again.",
        );
      } else {
        Alert.alert(
          "Something went wrong",
          "We couldn't add this tracking number right now. Please try again later.",
        );
      }
    } finally {
      setAdding(false);
    }
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
              <TouchableOpacity
                key={item.id}
                style={styles.shipmentCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/(customer)/tracking/[trackingId]",
                    params: { trackingId: item.trackingNumber || item.id },
                  })
                }
              >
                <Text style={styles.trackingLabel}>Tracking number</Text>
                <Text style={styles.trackingValue}>
                  {item.trackingNumber || item.id}
                </Text>
                <Text style={styles.trackingHint}>
                  Tap to view live status and details.
                </Text>
              </TouchableOpacity>
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
                  disabled={!trackingNumber || adding}
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

