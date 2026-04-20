import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import ShipmentPackagesStats from "./ShipmentPackagesStats";
import ShipmentPackagesToolbar from "./ShipmentPackagesToolbar";
import PackageListItem from "../../checker/shipment-details/PackageListItem";
import PackageActionModal from "../../checker/shipment-details/PackageActionModal";

export default function ShipmentPackagesPanel({
  shipment,
  packages = [],
  editable = false,
  onSubmitAction,
  loading = false,
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [targetPackage, setTargetPackage] = useState(null);

  const getPackageKey = (pkg) => pkg?.packageId || pkg?.trackingNumber;

  const filteredPackages = useMemo(() => {
    const term = search.toLowerCase();
    return packages.filter((pkg) =>
      String(getPackageKey(pkg) || "")
        .toLowerCase()
        .includes(term),
    );
  }, [packages, search]);

  const handleToggleSelect = (pkg) => {
    const packageKey = getPackageKey(pkg);
    if (!packageKey) return;

    const next = new Set(selectedIds);
    if (next.has(packageKey)) next.delete(packageKey);
    else next.add(packageKey);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredPackages.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(filteredPackages.map((pkg) => getPackageKey(pkg))));
  };

  const getAvailableQuantity = () => {
    if (targetPackage) {
      return Number(targetPackage.quantity) || 1;
    }

    return packages
      .filter((pkg) => selectedIds.has(getPackageKey(pkg)))
      .reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0);
  };

  const handleAction = async (actionCode, remarks = "", quantity = null) => {
    const idsToUpdate = targetPackage
      ? [getPackageKey(targetPackage)]
      : Array.from(selectedIds);

    if (!idsToUpdate.length) return;

    await onSubmitAction({
      packageIds: idsToUpdate,
      newStatus: actionCode,
      remarks,
      manualQty: targetPackage ? quantity : null,
    });

    setSelectedIds(new Set());
    setTargetPackage(null);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Packages ({packages.length})</Text>

      <ShipmentPackagesStats shipment={shipment} />

      <ShipmentPackagesToolbar
        search={search}
        onChangeSearch={setSearch}
        editable={editable}
        selectedCount={selectedIds.size}
        totalFiltered={filteredPackages.length}
        onToggleSelectAll={handleSelectAll}
      />

      <FlatList
        data={filteredPackages}
        keyExtractor={(item) => getPackageKey(item)}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {search ? "No packages match your search." : "No packages found."}
          </Text>
        }
        renderItem={({ item }) => (
          <PackageListItem
            item={item}
            selected={selectedIds.has(getPackageKey(item))}
            isSelectionMode={editable && selectedIds.size > 0}
            onLongPress={
              editable
                ? () => {
                    handleToggleSelect(item);
                  }
                : undefined
            }
            onMenuPress={
              editable
                ? () => {
                    setTargetPackage(item);
                    setModalVisible(true);
                  }
                : undefined
            }
          />
        )}
      />

      {editable && selectedIds.size > 0 && (
        <TouchableOpacity
          style={styles.bulkButton}
          onPress={() => {
            setTargetPackage(null);
            setModalVisible(true);
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bulkButtonText}>
              Update {selectedIds.size} Items
            </Text>
          )}
        </TouchableOpacity>
      )}

      {editable && (
        <PackageActionModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setTargetPackage(null);
          }}
          count={targetPackage ? 1 : selectedIds.size}
          maxQty={getAvailableQuantity()}
          onAction={handleAction}
          noteRemarks={targetPackage?.remarks || ""}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 16,
  },
  bulkButton: {
    marginTop: 12,
    backgroundColor: "#0F172A",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  bulkButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
