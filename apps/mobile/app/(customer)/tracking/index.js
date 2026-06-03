import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { FontAwesome5 } from "@expo/vector-icons";

import { db } from "../../../firebase";
import {
  createConversation,
  sendChatMessage,
} from "../../../components/utilities/FirebaseFunctions";
import TripProgressStepper from "../../../components/trips/TripProgressStepper";
import ShipmentDetailHeader from "../../../components/shipments/ShipmentDetailHeader";
import ShipmentHeaderCard from "../../../components/shipments/ShipmentHeaderCard";
import ShipmentPackagesPanel from "../../../components/shipments/details/ShipmentPackagesPanel";
import ExistingProofsViewer from "../../../components/tracking/ExistingProofsViewer";
import { useTheme } from "../../../contexts/ThemeContext";

export default function CustomerTrackingDetailsScreen() {
  const { trackingId } = useLocalSearchParams();
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const statusStyle = resolvedScheme === "dark" ? "light" : "dark";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shipment, setShipment] = useState(null);
  const [startingChat, setStartingChat] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  const normalizedTracking = useMemo(
    () =>
      String(trackingId || "")
        .trim()
        .toUpperCase(),
    [trackingId],
  );

  const fetchData = useCallback(async () => {
    if (!normalizedTracking) {
      setError("Invalid tracking number.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const snap = await getDoc(doc(db, "shipments", normalizedTracking));

      if (!snap.exists()) {
        setShipment(null);
        setError("Shipment not found. Please check your tracking ID.");
        return;
      }

      setShipment({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error("Failed to load tracking details:", err);
      setShipment(null);
      setError("System offline. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [normalizedTracking]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const packages = shipment?.packages || [];

  const displayShipment = useMemo(() => {
    if (!shipment) return null;

    const hasTotals =
      shipment?.totals?.totalContentQty != null ||
      shipment?.totals?.totalItems != null;

    if (hasTotals) return shipment;

    const derivedTotals = packages.reduce(
      (acc, pkg) => {
        const quantity = Number(pkg?.quantity) || 1;
        const status = String(pkg?.status || "").toUpperCase();

        acc.totalContentQty += quantity;
        if (status === "LOADED") acc.loaded += quantity;
        if (status === "MISSING") acc.missing += quantity;

        return acc;
      },
      { loaded: 0, missing: 0, totalContentQty: 0 },
    );

    return {
      ...shipment,
      totals: {
        ...(shipment.totals || {}),
        ...derivedTotals,
      },
    };
  }, [packages, shipment]);

  const progressType = useMemo(() => {
    const status = String(shipment?.status || "").toUpperCase();
    const rawType = String(shipment?.tripType || shipment?.routeType || "")
      .trim()
      .toUpperCase();

    if (rawType === "LOCAL_PICKUP" || shipment?.isPickupRequested === true) {
      return "SHIPMENT_PICKUP";
    }

    if (status === "PENDING_PICKUP" || status === "PICKED_UP") {
      return "SHIPMENT_PICKUP";
    }

    return "SHIPMENT_DELIVERY";
  }, [
    shipment?.isPickupRequested,
    shipment?.routeType,
    shipment?.status,
    shipment?.tripType,
  ]);

  const handleMessageSupport = async () => {
    const message = supportMessage.trim();
    if (!message) {
      Alert.alert("Message required", "Type a message to contact support.");
      return;
    }

    try {
      setStartingChat(true);
      const result = await createConversation({
        trackingNumber: shipment?.trackingNumber || shipment?.id || normalizedTracking,
        message,
      });
      const conversationId = result?.data?.conversationId;
      if (conversationId) {
        if (result?.data?.reused) {
          await sendChatMessage({ conversationId, text: message });
        }

        setSupportMessage("");
        setSupportModalVisible(false);
        router.push({
          pathname: "/(customer)/chat/[conversationId]",
          params: { conversationId },
        });
      }
    } catch (err) {
      console.error("Failed to open support chat:", err);
      Alert.alert("Unable to send", "Please try again in a moment.");
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <StatusBar style={statusStyle} />
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar style={statusStyle} />
        <ShipmentDetailHeader
          title="Tracking Details"
          subtitle="Shipment lookup"
          onBack={() => router.back()}
        />

        <View style={styles.emptyState}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <FontAwesome5 name="box-open" size={22} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Shipment unavailable
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {error || "The selected shipment could not be loaded."}
          </Text>

          <TouchableOpacity
            style={[
              styles.backGhostBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backGhostBtnText, { color: colors.text }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={statusStyle} backgroundColor={colors.bg} />

      <ShipmentDetailHeader
        title="Tracking Details"
        subtitle={shipment.id || normalizedTracking}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ShipmentHeaderCard shipment={shipment} showActions={false} />

        <TouchableOpacity
          style={[
            styles.supportButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => setSupportModalVisible(true)}
          disabled={startingChat}
          activeOpacity={0.85}
        >
          <View style={styles.supportIcon}>
            <FontAwesome5 name="comments" size={15} color="#2563eb" />
          </View>
          <View style={styles.supportTextWrap}>
            <Text style={[styles.supportTitle, { color: colors.text }]}>
              Message Support
            </Text>
            <Text style={[styles.supportSubtitle, { color: colors.textMuted }]}>
              Ask about this shipment
            </Text>
          </View>
          {startingChat ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <FontAwesome5
              name="chevron-right"
              size={13}
              color={colors.textMuted}
            />
          )}
        </TouchableOpacity>

        <Modal
          transparent
          animationType="fade"
          visible={supportModalVisible}
          onRequestClose={() => setSupportModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Message Support
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                This shipment chat appears after your message is sent.
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  },
                ]}
                value={supportMessage}
                onChangeText={setSupportMessage}
                placeholder="Ask about this shipment..."
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalCancel,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.cardMuted,
                    },
                  ]}
                  onPress={() => {
                    setSupportModalVisible(false);
                    setSupportMessage("");
                  }}
                  disabled={startingChat}
                >
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSend,
                    (!supportMessage.trim() || startingChat) &&
                      styles.sendDisabled,
                  ]}
                  onPress={handleMessageSupport}
                  disabled={!supportMessage.trim() || startingChat}
                >
                  {startingChat ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSendText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TripProgressStepper
          currentStatus={shipment.status}
          tripType={progressType}
        />

        <ExistingProofsViewer
          proofOfReceipt={shipment.proofOfReceipt}
          proofOfDelivery={shipment.proofOfDelivery}
        />

        <ShipmentPackagesPanel
          shipment={displayShipment}
          packages={packages}
          editable={false}
          showOverview={false}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  supportIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  supportTextWrap: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  supportSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    minHeight: 112,
    maxHeight: 180,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontWeight: "800",
  },
  modalSend: {
    minWidth: 82,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  sendDisabled: {
    opacity: 0.45,
  },
  modalSendText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
  },
  backGhostBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  backGhostBtnText: {
    color: "#0f172a",
    fontWeight: "600",
  },
});
