import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useDeliveryManifests } from "../../hooks/useDeliveryManifests";
import DeliveryManifestCard from "../../components/checker/DeliveryManifestCard";

export default function DeliveryLoadScreen({ showBackButton = false }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { manifests, summary, loading } = useDeliveryManifests(profile?.uid);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const openShipment = (shipmentId) => {
    router.push({
      pathname: "/(checker)/shipment-details",
      params: { shipmentId },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {showBackButton && (
        <View style={styles.backRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="arrow-left" size={14} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            My Delivery Load
          </Text>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {summary.manifestCount} active load
            {summary.manifestCount === 1 ? "" : "s"} · {summary.totalPackages}{" "}
            packages · {summary.outForDelivery} out · {summary.delivered}{" "}
            delivered · {summary.remaining} remaining
          </Text>
          <TouchableOpacity
            style={[styles.scanBtn, { borderColor: colors.border }]}
            onPress={() =>
              router.push({
                pathname: "/(checker)/scan",
                params: { mode: "delivery", title: "Last-Mile Delivery" },
              })
            }
            activeOpacity={0.85}
          >
            <FontAwesome5 name="qrcode" size={12} color={colors.text} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>
              Scan delivery action
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading delivery manifests...
            </Text>
          </View>
        ) : manifests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No active delivery load yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              When you load pieces from the available pool, your delivery
              manifest will appear here.
            </Text>
          </View>
        ) : (
          manifests.map((manifest) => (
            <DeliveryManifestCard
              key={manifest.id}
              manifest={manifest}
              colors={colors}
              onPressShipment={openShipment}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  summaryCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  scanBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    marginTop: 18,
    borderRadius: 14,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 18,
  },
});
