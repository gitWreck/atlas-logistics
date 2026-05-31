import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  countDeliveryPoolPieces,
  formatPoolCountLine,
  isAvailableToLoadShipment,
} from "../../components/utilities/checkerDeliveryPool";

function getTimeLabel(value) {
  if (!value) return "No recent update";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent update";
  return date.toLocaleString();
}

export default function AvailableToLoadScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile?.uid) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    const availableQuery = query(
      collection(db, "shipments"),
      where("availableForDelivery", "==", true),
    );

    const unsub = onSnapshot(
      availableQuery,
      (snap) => {
        const checkerId = profile.uid;
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((shipment) => isAvailableToLoadShipment(shipment))
          .map((shipment) => ({
            ...shipment,
            poolStats: countDeliveryPoolPieces(shipment, checkerId),
          }))
          .filter((shipment) => shipment.poolStats.available > 0)
          .sort((a, b) => {
            const aMs = a?.updatedAt?.toMillis?.() || 0;
            const bMs = b?.updatedAt?.toMillis?.() || 0;
            return bMs - aMs;
          });

        setItems(next);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Available-to-load snapshot failed:", error);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsub();
  }, [profile?.uid]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.shipments += 1;
        acc.available += item.poolStats?.available || 0;
        acc.mine += item.poolStats?.mine || 0;
        acc.others += item.poolStats?.others || 0;
        return acc;
      },
      { shipments: 0, available: 0, mine: 0, others: 0 },
    );
  }, [items]);

  const openLoadScan = () => {
    router.push({
      pathname: "/(checker)/scan",
      params: { mode: "delivery", title: "Load to Van" },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(true)}
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
            Available at Warehouse
          </Text>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {summary.available} piece{summary.available === 1 ? "" : "s"} ready
            across {summary.shipments} shipment
            {summary.shipments === 1 ? "" : "s"}
            {summary.mine > 0 ? ` · ${summary.mine} already on your van` : ""}
            {summary.others > 0
              ? ` · ${summary.others} with other checkers`
              : ""}
          </Text>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Custody stays at Odiongan until you scan each label and load it to
            your van.
          </Text>
          <TouchableOpacity
            style={[styles.scanBtn, { borderColor: colors.border }]}
            onPress={openLoadScan}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="qrcode" size={12} color={colors.text} />
            <Text style={[styles.scanBtnText, { color: colors.text }]}>
              Scan to load piece
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Loading available inventory...
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nothing available to load
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              When Rose releases a trip for delivery operations, pieces will
              appear here for any checker to load.
            </Text>
          </View>
        ) : (
          items.map((shipment) => (
            <View
              key={shipment.id}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/(checker)/shipment-details",
                    params: { shipmentId: shipment.id },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.idWrap}>
                    <FontAwesome5 name="warehouse" size={12} color={colors.textMuted} />
                    <Text style={[styles.shipmentId, { color: colors.text }]}>
                      {shipment.shipmentId || shipment.id}
                    </Text>
                  </View>
                  <StatusBadge
                    status={shipment.status || "AVAILABLE_FOR_DELIVERY"}
                  />
                </View>

                <Text style={[styles.poolLine, { color: colors.text }]}>
                  {formatPoolCountLine(shipment.poolStats)}
                </Text>

                {(shipment.destinationCode || shipment.recipient?.name) && (
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {shipment.destinationCode || "—"}
                    {shipment.recipient?.name
                      ? ` · ${shipment.recipient.name}`
                      : ""}
                  </Text>
                )}

                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  Updated {getTimeLabel(shipment.updatedAt)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loadBtn, { borderColor: colors.border }]}
                onPress={openLoadScan}
                activeOpacity={0.85}
              >
                <FontAwesome5 name="dolly" size={12} color={colors.text} />
                <Text style={[styles.loadBtnText, { color: colors.text }]}>
                  Scan load ({shipment.poolStats.available} available)
                </Text>
              </TouchableOpacity>
            </View>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  idWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  shipmentId: {
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  poolLine: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    marginBottom: 4,
  },
  loadBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  loadBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
