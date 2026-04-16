import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Text,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

import ShipmentHeader from "../../components/checker/shipment-details/ShipmentHeader";
import ShipmentSearch from "../../components/checker/shipment-details/ShipmentSearch";
import PackageListItem from "../../components/checker/shipment-details/PackageListItem";
import PackageActionModal from "../../components/checker/shipment-details/PackageActionModal";
import { updateShipmentPackages } from "../../components/utilities/FirebaseFunctions";
import { getCurrentLocationSafe } from "../../components/utilities/helpers";

export default function ShipmentDetailsScreen() {
  const { shipmentId, parentTripId } = useLocalSearchParams();
  const router = useRouter();

  const [shipment, setShipment] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null);
  const getPackageKey = (pkg) => pkg?.packageId || pkg?.trackingNumber;

  useEffect(() => {
    if (!shipmentId) return;
    return onSnapshot(doc(db, "shipments", shipmentId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setShipment(data);
        setPackages(
          (data.packages || []).sort((a, b) => a.sequence - b.sequence),
        );
      }
      setLoading(false);
    });
  }, [shipmentId]);

  const filteredPackages = useMemo(() => {
    return packages.filter((p) =>
      getPackageKey(p)?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [packages, search]);

  const executeAction = async (actionCode, remarks = "", quantity) => {
    const idsToUpdate = targetPackage
      ? [getPackageKey(targetPackage)]
      : Array.from(selectedIds);

    setActionLoading(true);
    try {
      const location = await getCurrentLocationSafe();

      // ✅ ADJUSTED: Pass the manualQty to the Firebase function
      await updateShipmentPackages({
        shipmentId,
        packageIds: idsToUpdate,
        newStatus: actionCode,
        tripId: parentTripId,
        remarks,
        location,
        // manualQty: quantity, // This supports the partial loading of Sacks/Bundles
        // ✅ FIX: Only send quantity if a SINGLE package is targeted.
        // For bulk, sending null tells the backend to use individual package quantities.
        manualQty: targetPackage ? quantity : null,
      });

      setSelectedIds(new Set());
      setTargetPackage(null);
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getAvailableQuantity = () => {
    if (targetPackage) {
      return Number(targetPackage.quantity) || 1;
    }
    // For bulk selection, we sum the quantities of all selected items
    return packages
      .filter((p) => selectedIds.has(getPackageKey(p)))
      .reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);
  };

  // --- RENDER HEADER COMPONENTS ---

  const renderListHeader = () => {
    const totals = shipment?.totals || {};
    const percent =
      totals.totalContentQty > 0
        ? (((totals.loaded || 0) + (totals.missing || 0)) /
            totals.totalContentQty) *
          100
        : 0;

    return (
      <View style={styles.listHeaderContainer}>
        {/* STATS & PROGRESS (These will scroll away) */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#2563eb" }]}>
                {totals.loaded || 0}
              </Text>
              <Text style={styles.statLabel}>LOADED</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#dc2626" }]}>
                {totals.missing || 0}
              </Text>
              <Text style={styles.statLabel}>MISSING</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {totals.totalContentQty || 0}
              </Text>
              <Text style={styles.statLabel}>COUNT</Text>
            </View>
          </View>
          <View style={styles.progressRow}>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.percentText}>{Math.round(percent)}%</Text>
          </View>
        </View>

        {/* SEARCH & SELECTION (This part will STICK) */}
        <View style={styles.stickyHeaderContent}>
          <ShipmentSearch value={search} onChange={setSearch} />
          <View style={styles.selectionBar}>
            <TouchableOpacity
              onPress={() => {
                if (selectedIds.size === filteredPackages.length)
                  setSelectedIds(new Set());
                else
                  setSelectedIds(
                    new Set(filteredPackages.map((p) => getPackageKey(p))),
                  );
              }}
            >
              <Text style={styles.linkText}>
                {selectedIds.size > 0 ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectionCount}>
              {selectedIds.size} Selected
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ShipmentHeader
        shipmentId={shipmentId}
        shipment={shipment}
        onBack={() => router.back()}
      />

      <FlatList
        data={filteredPackages}
        keyExtractor={(item) => getPackageKey(item)}
        ListHeaderComponent={renderListHeader}
        stickyHeaderIndices={[0]} // This references the wrapper inside ListHeaderComponent
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PackageListItem
            item={item}
            selected={selectedIds.has(getPackageKey(item))}
            isSelectionMode={selectedIds.size > 0} // ✅ ADD THIS LINE
            onMenuPress={(pkg) => {
              setTargetPackage(pkg);
              setModalVisible(true);
            }}
            onLongPress={(pkg) => {
              const next = new Set(selectedIds);
              const packageKey = getPackageKey(pkg);
              if (next.has(packageKey)) next.delete(packageKey);
              else next.add(packageKey);
              setSelectedIds(next);
            }}
          />
        )}
      />

      {selectedIds.size > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setTargetPackage(null);
            setModalVisible(true);
          }}
        >
          <Text style={styles.fabText}>Update {selectedIds.size} Items</Text>
        </TouchableOpacity>
      )}

      {actionLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <PackageActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        count={targetPackage ? 1 : selectedIds.size}
        // ✅ NEW: Pass the pieces count so the user can do partial loading
        maxQty={getAvailableQuantity()}
        onAction={executeAction}
        noteRemarks={targetPackage?.remarks || ""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  listHeaderContainer: { backgroundColor: "#F8FAFC" },
  statsSection: { padding: 20, backgroundColor: "#fff" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  statBox: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  statLabel: { fontSize: 9, fontWeight: "700", color: "#94a3b8", marginTop: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#2563eb" },
  percentText: { fontSize: 12, fontWeight: "700", color: "#1e293b" },

  // Sticky Container Styles
  stickyHeaderContent: {
    backgroundColor: "#F8FAFC",
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  linkText: { color: "#3B82F6", fontWeight: "700", fontSize: 13 },
  selectionCount: { color: "#64748B", fontSize: 12 },

  list: { paddingBottom: 120 },
  fab: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#0F172A",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});
