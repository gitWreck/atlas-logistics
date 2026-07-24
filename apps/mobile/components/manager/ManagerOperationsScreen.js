import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import StatusBadge from "../ui/StatusBadge";
import {
  assignCheckerMunicipalities,
  listManagerMobileOperations,
} from "../utilities/FirebaseFunctions";
import { DELIVERY_MUNICIPALITIES } from "../utilities/deliveryMunicipalities";
import useManagerRequest from "./useManagerRequest";
import ManagerCreateTripModal from "./ManagerCreateTripModal";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagerCard,
  ManagerHeader,
  displayName,
  formatDate,
} from "./ManagerUI";

const DONE = new Set(["COMPLETED", "DELIVERED", "CANCELLED", "CANCELED", "ARCHIVED", "CLOSED"]);

function staffAssignment(member = {}) {
  return (
    member.currentAssignment ||
    member.assignedTripId ||
    member.currentTripId ||
    member.assignedRoute ||
    member.routeName ||
    "No current assignment"
  );
}

export default function ManagerOperationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [editingChecker, setEditingChecker] = useState(null);
  const [selectedMunicipalities, setSelectedMunicipalities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [createTripVisible, setCreateTripVisible] = useState(false);
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    listManagerMobileOperations,
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (tab === "staff") {
      return (data?.staff || []).filter((member) =>
        [
          displayName(member),
          member.role,
          member.warehouseName,
          member.warehouseCode,
          member.assignedMunicipality,
          ...(member.assignedMunicipalities || []),
          member.status,
          member.employmentStatus,
          staffAssignment(member),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }
    return (data?.trips || []).filter((trip) => {
      const complete = trip.archived === true || DONE.has(String(trip.status || "").toUpperCase());
      if (tab === "active" ? complete : !complete) return false;
      return [
        trip.id,
        trip.tripId,
        trip.route,
        trip.origin,
        trip.destination,
        trip.driverName,
        trip.checkerName,
        trip.truckPlateNumber,
        trip.municipality,
        ...(trip.municipalityCoverage || []),
        trip.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, search, tab]);

  if (loading) return <LoadingState label="Loading trips and staff…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const allowedMunicipalities = data?.scope?.municipalities?.length
    ? data.scope.municipalities
    : DELIVERY_MUNICIPALITIES;
  const openCheckerAssignment = (checker) => {
    setEditingChecker(checker);
    setSelectedMunicipalities(
      Array.isArray(checker.assignedMunicipalities)
        ? checker.assignedMunicipalities
        : [],
    );
  };
  const saveCheckerAssignment = async () => {
    if (!editingChecker || !selectedMunicipalities.length || saving) return;
    try {
      setSaving(true);
      await assignCheckerMunicipalities({
        checkerId: editingChecker.id,
        municipalities: selectedMunicipalities,
      });
      setEditingChecker(null);
      await reload({ refresh: true });
    } catch (nextError) {
      Alert.alert("Assignment not saved", nextError.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const openTrip = (trip) =>
    router.push({
      pathname: "/(manager)/trip-details",
      params: { tripId: trip.id },
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        title="Trip Board"
        subtitle="Routes, manifests, assignments, timelines, and reported issues"
        actionIcon="plus"
        onAction={() => setCreateTripVisible(true)}
      />
      <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
        <View style={[styles.tabs, { backgroundColor: colors.cardMuted }]}>
          {[
            ["active", "Active Trips"],
            ["completed", "Completed"],
          ].map(([value, label]) => {
            const active = value === tab;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, { color: active ? "#fff" : colors.textMuted }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.search, { backgroundColor: colors.cardMuted }]}>
          <Feather name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search trip, route, Driver, Checker, or truck"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#0f766e"
          />
        }
        contentContainerStyle={rows.length ? styles.list : styles.emptyList}
        renderItem={({ item }) =>
          tab === "staff" ? (
            <StaffCard
              item={item}
              colors={colors}
              onManage={
                String(item.role || "").toLowerCase() === "checker"
                  ? () => openCheckerAssignment(item)
                  : null
              }
            />
          ) : (
            <Pressable
              onPress={() => openTrip(item)}
            >
              <TripCard item={item} colors={colors} onActions={() => openTrip(item)} />
            </Pressable>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon={tab === "staff" ? "users" : "truck"}
            title={tab === "staff" ? "No authorized staff found" : "No trips found"}
            message="Only records inside your assigned operational scope appear here."
          />
        }
      />
      <Modal
        visible={Boolean(editingChecker)}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setEditingChecker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Checker municipalities
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              {displayName(editingChecker || {})} can only be assigned inside your Manager scope.
            </Text>
            <ScrollView style={styles.modalList}>
              {allowedMunicipalities.map((municipality) => {
                const selected = selectedMunicipalities.includes(municipality);
                return (
                  <Pressable
                    key={municipality}
                    onPress={() =>
                      setSelectedMunicipalities((current) =>
                        selected
                          ? current.filter((value) => value !== municipality)
                          : [...current, municipality],
                      )
                    }
                    style={[styles.option, { borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.checkbox, { borderColor: selected ? "#0f766e" : colors.border }, selected && styles.checkboxSelected]}>
                      {selected ? <Feather name="check" size={13} color="#fff" /> : null}
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]}>{municipality}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                disabled={saving}
                onPress={() => setEditingChecker(null)}
                style={[styles.modalButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={saving || !selectedMunicipalities.length}
                onPress={saveCheckerAssignment}
                style={[styles.modalButton, styles.saveButton, (!selectedMunicipalities.length || saving) && styles.disabled]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save assignment</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ManagerCreateTripModal
        visible={createTripVisible}
        scope={data?.scope}
        staff={data?.staff}
        onClose={() => setCreateTripVisible(false)}
        onCreated={() => reload({ refresh: true })}
      />
    </View>
  );
}

function TripCard({ item, colors, onActions }) {
  const issue = item.delayReason || item.issue || item.issueReport || item.reportedIssue;
  return (
    <ManagerCard>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.tripId || item.id}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {[item.origin || item.originCode || "Divisoria", item.destination || item.destinationCode || "Odiongan"].join(" → ")}
          </Text>
        </View>
        <StatusBadge status={item.status} />
        <Pressable
          accessibilityLabel={`Actions for ${item.tripId || item.id}`}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation?.();
            onActions?.();
          }}
          style={[styles.moreButton, { backgroundColor: colors.cardMuted }]}
        >
          <Feather name="more-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.tripFacts}>
        <Fact icon="user" value={item.driverName || "Driver unassigned"} colors={colors} />
        <Fact icon="user-check" value={item.checkerName || "Checker unassigned"} colors={colors} />
        <Fact icon="truck" value={item.truckPlateNumber || item.vehiclePlate || "Truck unassigned"} colors={colors} />
        <Fact icon="package" value={`${item.shipmentTotal ?? item.totalShipments ?? item.shipments?.length ?? 0} shipments`} colors={colors} />
      </View>
      <Text style={[styles.update, { color: colors.textMuted }]}>
        Updated {formatDate(item.updatedAt || item.createdAt)}
      </Text>
      {issue ? (
        <View style={[styles.issue, { backgroundColor: colors.warningSoft }]}>
          <Feather name="alert-triangle" size={14} color={colors.warning} />
          <Text style={[styles.issueText, { color: colors.warning }]} numberOfLines={3}>
            {typeof issue === "string" ? issue : issue.description || issue.message || "Reported trip issue"}
          </Text>
        </View>
      ) : null}
    </ManagerCard>
  );
}

function StaffCard({ item, colors, onManage }) {
  const municipalities = [
    ...(item.assignedMunicipalities || []),
    item.assignedMunicipality,
    item.municipality,
  ].filter(Boolean);
  const status = item.employmentStatus || item.status || (item.active === false ? "Inactive" : "Active");
  return (
    <ManagerCard>
      <View style={styles.staffTop}>
        <View style={[styles.avatar, { backgroundColor: colors.cardMuted }]}>
          <Feather
            name={String(item.role).toLowerCase() === "driver" ? "truck" : "user"}
            size={20}
            color="#0f766e"
          />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{displayName(item)}</Text>
          <Text style={[styles.role, { color: "#0f766e" }]}>
            {String(item.role || "staff").toUpperCase()} • {status}
          </Text>
        </View>
      </View>
      <View style={[styles.staffDetails, { borderTopColor: colors.border }]}>
        <Fact icon="home" value={item.warehouseName || item.warehouseCode || "Warehouse not listed"} colors={colors} />
        <Fact icon="map-pin" value={municipalities.join(", ") || "Warehouse-wide"} colors={colors} />
        <Fact icon="briefcase" value={staffAssignment(item)} colors={colors} />
      </View>
      {onManage ? (
        <Pressable style={styles.manageButton} onPress={onManage}>
          <Feather name="map" size={14} color="#fff" />
          <Text style={styles.manageText}>Manage municipalities</Text>
        </Pressable>
      ) : null}
    </ManagerCard>
  );
}

function Fact({ icon, value, colors }) {
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={14} color={colors.textMuted} />
      <Text style={[styles.factText, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { padding: 13, gap: 10 },
  tabs: { flexDirection: "row", borderRadius: 13, padding: 4, gap: 3 },
  tab: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#0f766e" },
  tabText: { fontSize: 11, fontWeight: "800" },
  search: { minHeight: 45, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, padding: 0, fontSize: 13 },
  list: { padding: 14, paddingBottom: 28, gap: 11 },
  emptyList: { flexGrow: 1 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  moreButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "900" },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  tripFacts: { marginTop: 13, gap: 8 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  factText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  update: { fontSize: 10, marginTop: 12 },
  issue: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 11, padding: 10, marginTop: 12 },
  issueText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  staffTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  role: { fontSize: 10, fontWeight: "900", marginTop: 4 },
  staffDetails: { borderTopWidth: 1, paddingTop: 12, marginTop: 13, gap: 8 },
  manageButton: { minHeight: 42, marginTop: 13, borderRadius: 12, backgroundColor: "#0f766e", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  manageText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  modalSheet: { maxHeight: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  modalTitle: { fontSize: 19, fontWeight: "900" },
  modalSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 5, marginBottom: 12 },
  modalList: { maxHeight: 390 },
  option: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  optionText: { fontSize: 14, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  saveButton: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  disabled: { opacity: 0.55 },
  cancelText: { fontWeight: "800" },
  saveText: { color: "#fff", fontWeight: "800" },
});
