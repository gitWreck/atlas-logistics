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
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import {
  archiveTruckTrip,
  assignCheckerMunicipalities,
  cancelTruckTrip,
  listManagerMobileOperations,
} from "../utilities/FirebaseFunctions";
import { DELIVERY_MUNICIPALITIES } from "../utilities/deliveryMunicipalities";
import useManagerRequest from "./useManagerRequest";
import ManagerCreateTripModal from "./ManagerCreateTripModal";
import ManagerTripScheduleModal from "./ManagerTripScheduleModal";
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
const SCHEDULED = new Set(["CREATED", "LOADED"]);

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
  const { profile } = useAuth();
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionTrip, setActionTrip] = useState(null);
  const [scheduleTrip, setScheduleTrip] = useState(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState(null);
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
      const tripStatus = String(trip.status || "").toUpperCase();
      const tripType = String(trip.tripType || trip.routeType || "").toUpperCase();
      const complete = trip.archived === true || DONE.has(tripStatus);
      if (tab === "active" && complete) return false;
      if (tab === "scheduled" && (complete || !SCHEDULED.has(tripStatus))) {
        return false;
      }
      if (tab === "completed" && !complete) return false;
      if (statusFilter !== "ALL" && tripStatus !== statusFilter) return false;
      if (typeFilter !== "ALL" && tripType !== typeFilter) return false;
      const tripDate = new Date(
        trip.plannedDeparture ||
          trip.departureAt ||
          trip.createdAt ||
          trip.updatedAt ||
          0,
      );
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (Number.isFinite(start.getTime()) && tripDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (Number.isFinite(end.getTime()) && tripDate > end) return false;
      }
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
  }, [data, endDate, search, startDate, statusFilter, tab, typeFilter]);

  const tripCounts = useMemo(() => {
    const trips = data?.trips || [];
    return {
      active: trips.filter((trip) => {
        const status = String(trip.status || "").toUpperCase();
        return trip.archived !== true && !DONE.has(status);
      }).length,
      scheduled: trips.filter((trip) =>
        SCHEDULED.has(String(trip.status || "").toUpperCase()),
      ).length,
      completed: trips.filter((trip) => {
        const status = String(trip.status || "").toUpperCase();
        return trip.archived === true || DONE.has(status);
      }).length,
    };
  }, [data?.trips]);
  const upcomingTrips = useMemo(
    () =>
      (data?.trips || [])
        .filter((trip) =>
          SCHEDULED.has(String(trip.status || "").toUpperCase()),
        )
        .sort((left, right) => {
          const departure = (trip) => {
            const value =
              trip.plannedDeparture ||
              trip.departure ||
              trip.departureAt ||
              trip.scheduledDeparture;
            const time = new Date(value || 0).getTime();
            return Number.isFinite(time) && value
              ? time
              : Number.POSITIVE_INFINITY;
          };
          return departure(left) - departure(right);
        }),
    [data?.trips],
  );

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
  const openTripAudit = (trip) =>
    router.push({
      pathname: "/(manager)/trip-details",
      params: { tripId: trip.id, tab: "actions" },
    });
  const role = String(profile?.role || "").toLowerCase();
  const canManageLifecycle =
    role === "admin" ||
    (role === "manager" &&
      String(profile?.email || "").toLowerCase() === "roselyn@gmail.com");
  const openSchedule = (trip = null) => {
    setActionTrip(null);
    setScheduleTrip(trip);
    setScheduleVisible(true);
  };
  const runLifecycle = async (reason) => {
    if (!lifecycleAction || saving) return;
    const { type, trip } = lifecycleAction;
    try {
      setSaving(true);
      await (type === "cancel" ? cancelTruckTrip : archiveTruckTrip)({
        tripId: trip.id,
        reason,
      });
      setLifecycleAction(null);
      setActionTrip(null);
      await reload({ refresh: true });
    } catch (nextError) {
      Alert.alert(
        type === "cancel" ? "Trip not cancelled" : "Trip not archived",
        nextError.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        title="Trip Board"
        subtitle="Routes, manifests, assignments, timelines, and reported issues"
        actionIcon="plus"
        onAction={() => setCreateTripVisible(true)}
      />
      <FlatList
        style={styles.boardScroll}
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
        ListHeaderComponent={
          <>
      <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
        <View style={[styles.tabs, { backgroundColor: colors.cardMuted }]}>
          {[
            ["active", "Active", tripCounts.active],
            ["scheduled", "Scheduled", tripCounts.scheduled],
            ["completed", "Completed", tripCounts.completed],
          ].map(([value, label, count]) => {
            const active = value === tab;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, { color: active ? "#fff" : colors.textMuted }]}>
                  {label} {count}
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
          <Pressable
            accessibilityLabel="Trip filters"
            onPress={() => setFiltersOpen((current) => !current)}
            style={[
              styles.filterButton,
              filtersOpen && styles.filterButtonActive,
            ]}
          >
            <Feather
              name="sliders"
              size={17}
              color={filtersOpen ? "#fff" : colors.textMuted}
            />
          </Pressable>
        </View>
        {tab === "scheduled" ? (
          <Pressable
            onPress={() => openSchedule(null)}
            style={styles.scheduleButton}
          >
            <Feather name="calendar" size={16} color="#fff" />
            <Text style={styles.scheduleButtonText}>Create Trip Schedule</Text>
          </Pressable>
        ) : null}
        {filtersOpen ? (
          <View
            style={[
              styles.filters,
              { borderColor: colors.border, backgroundColor: colors.cardMuted },
            ]}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              STATUS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChips}>
                {["ALL", "CREATED", "LOADING", "LOADED", "IN_TRANSIT", "ARRIVED"].map(
                  (value) => (
                    <FilterChip
                      key={value}
                      label={value.replace(/_/g, " ")}
                      active={statusFilter === value}
                      colors={colors}
                      onPress={() => setStatusFilter(value)}
                    />
                  ),
                )}
              </View>
            </ScrollView>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              TRIP TYPE
            </Text>
            <View style={styles.filterChips}>
              {["ALL", "HUB_TRANSFER", "LOCAL_PICKUP", "DELIVERY"].map(
                (value) => (
                  <FilterChip
                    key={value}
                    label={value.replace(/_/g, " ")}
                    active={typeFilter === value}
                    colors={colors}
                    onPress={() => setTypeFilter(value)}
                  />
                ),
              )}
            </View>
            <View style={styles.dateRow}>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="From YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.dateInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="To YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.dateInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
            </View>
            <Pressable
              onPress={() => {
                setStatusFilter("ALL");
                setTypeFilter("ALL");
                setStartDate("");
                setEndDate("");
              }}
              style={styles.clearFilters}
            >
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
            {tab === "scheduled" ? (
            <UpcomingDepartures
              trips={upcomingTrips}
              colors={colors}
              onOpen={openTrip}
              onEdit={openSchedule}
            />
            ) : null}
          </>
        }
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
              <TripCard
                item={item}
                colors={colors}
                scheduled={tab === "scheduled"}
                onActions={() => setActionTrip(item)}
              />
            </Pressable>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon={tab === "staff" ? "users" : "truck"}
            title={
              tab === "staff"
                ? "No authorized staff found"
                : tab === "scheduled"
                  ? "No scheduled trips found"
                  : "No trips found"
            }
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
      <TripActionSheet
        trip={actionTrip}
        colors={colors}
        canManageLifecycle={canManageLifecycle}
        onClose={() => setActionTrip(null)}
        onView={() => {
          const trip = actionTrip;
          setActionTrip(null);
          if (trip) openTrip(trip);
        }}
        onSchedule={() => openSchedule(actionTrip)}
        onAudit={() => {
          const trip = actionTrip;
          setActionTrip(null);
          if (trip) openTripAudit(trip);
        }}
        onCancel={() =>
          setLifecycleAction({ type: "cancel", trip: actionTrip })
        }
        onArchive={() =>
          setLifecycleAction({ type: "archive", trip: actionTrip })
        }
      />
      <TripReasonModal
        action={lifecycleAction}
        colors={colors}
        saving={saving}
        onClose={() => !saving && setLifecycleAction(null)}
        onConfirm={runLifecycle}
      />
      <ManagerTripScheduleModal
        visible={scheduleVisible}
        trip={scheduleTrip}
        trips={data?.trips || []}
        onClose={() => {
          setScheduleVisible(false);
          setScheduleTrip(null);
        }}
        onSaved={() => reload({ refresh: true })}
      />
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

function UpcomingDepartures({ trips, colors, onOpen, onEdit }) {
  const [departureType, setDepartureType] = useState("DELIVERY");
  const typeTrips = trips
    .filter((trip) => {
      const type = String(
        trip.tripType || trip.routeType || "HUB_TRANSFER",
      ).toUpperCase();
      if (departureType === "HUB_TRANSFER") return type.includes("HUB");
      if (departureType === "LOCAL_PICKUP") return type.includes("PICKUP");
      return type.includes("DELIVERY");
    })
    .slice(0, 5);
  return (
    <ManagerCard style={styles.upcomingCard}>
      <View style={styles.upcomingHeading}>
        <Feather name="truck" size={23} color="#1687ff" />
        <View style={styles.upcomingHeadingCopy}>
          <Text style={[styles.upcomingTitle, { color: colors.text }]}>
            Upcoming Departures
          </Text>
          <Text style={[styles.upcomingSubtitle, { color: colors.textMuted }]}>
            Earliest scheduled trips lined up for dispatch
          </Text>
        </View>
      </View>
      <View style={styles.departureTabs}>
        {[
          ["HUB_TRANSFER", "share-2", "Hub"],
          ["LOCAL_PICKUP", "truck", "Pickup"],
          ["DELIVERY", "briefcase", "Delivery"],
        ].map(([value, icon, label]) => {
          const active = departureType === value;
          return (
            <Pressable
              key={value}
              onPress={() => setDepartureType(value)}
              style={[
                styles.departureTab,
                active && styles.departureTabActive,
              ]}
            >
              <Feather
                name={icon}
                size={14}
                color={active ? "#fff" : colors.textMuted}
              />
              <Text
                style={[
                  styles.departureTabText,
                  { color: active ? "#fff" : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {typeTrips.length ? (
        <ScrollView
          nestedScrollEnabled
          style={styles.upcomingList}
          showsVerticalScrollIndicator
        >
          {typeTrips.map((trip, index) => {
            const departure =
              trip.plannedDeparture ||
              trip.departure ||
              trip.departureAt ||
              trip.scheduledDeparture;
            return (
              <Pressable
                key={trip.id}
                onPress={() => onOpen(trip)}
                style={[
                  styles.upcomingRow,
                  index > 0 && {
                    borderTopColor: colors.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={styles.upcomingDate}>
                  <Text style={[styles.upcomingDay, { color: colors.primary }]}>
                    {departure
                      ? new Date(departure).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "TBD"}
                  </Text>
                  <Text style={[styles.upcomingTime, { color: colors.textMuted }]}>
                    {departure
                      ? new Date(departure).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Not scheduled"}
                  </Text>
                </View>
                <View style={styles.upcomingCopy}>
                  <Text style={[styles.upcomingTripId, { color: colors.text }]}>
                    {trip.tripId || trip.id}
                  </Text>
                  <Text
                    style={[styles.upcomingMeta, { color: colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {trip.route ||
                      `${trip.origin || "Unknown"} → ${trip.destination || "Unknown"}`}
                  </Text>
                  <Text
                    style={[styles.upcomingMeta, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {[
                      trip.truckPlateNumber || "Truck unassigned",
                      trip.driverName || "Driver unassigned",
                    ].join(" • ")}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Edit schedule for ${trip.tripId || trip.id}`}
                  hitSlop={7}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onEdit(trip);
                  }}
                  style={[styles.upcomingEdit, { backgroundColor: colors.cardMuted }]}
                >
                  <Feather name="edit-2" size={15} color={colors.primary} />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.upcomingEmpty, { color: colors.textMuted }]}>
          No upcoming {departureType.replace(/_/g, " ").toLowerCase()} trips.
        </Text>
      )}
    </ManagerCard>
  );
}

function FilterChip({ label, active, colors, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          borderColor: active ? "#0f766e" : colors.border,
          backgroundColor: active ? "#0f766e" : colors.surface,
        },
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: active ? "#fff" : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TripActionSheet({
  trip,
  colors,
  canManageLifecycle,
  onClose,
  onView,
  onSchedule,
  onAudit,
  onCancel,
  onArchive,
}) {
  if (!trip) return null;
  const status = String(trip.status || "").toUpperCase();
  const canCancel =
    canManageLifecycle &&
    trip.archived !== true &&
    !["COMPLETED", "DELIVERED", "CANCELLED"].includes(status);
  const canArchive =
    canManageLifecycle &&
    trip.archived !== true &&
    (["COMPLETED", "DELIVERED", "CANCELLED"].includes(status) ||
      trip.active === false);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.actionBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation?.()}
          style={[styles.actionSheet, { backgroundColor: colors.surface }]}
        >
          <View style={styles.actionHandle} />
          <Text style={[styles.actionSheetTitle, { color: colors.text }]}>
            {trip.tripId || trip.id}
          </Text>
          <Text style={[styles.actionSheetMeta, { color: colors.textMuted }]}>
            Trip actions
          </Text>
          <SheetAction
            icon="folder"
            label="View trip details"
            colors={colors}
            onPress={onView}
          />
          {SCHEDULED.has(status) ? (
            <SheetAction
              icon="calendar"
              label="Edit trip schedule"
              colors={colors}
              onPress={onSchedule}
            />
          ) : null}
          {canManageLifecycle ? (
            <SheetAction
              icon="clipboard"
              label="View audit log"
              colors={colors}
              onPress={onAudit}
            />
          ) : null}
          {canCancel ? (
            <SheetAction
              icon="slash"
              label="Cancel trip"
              colors={colors}
              warning
              onPress={onCancel}
            />
          ) : null}
          {canArchive ? (
            <SheetAction
              icon="archive"
              label="Archive trip"
              colors={colors}
              danger
              onPress={onArchive}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetAction({
  icon,
  label,
  colors,
  onPress,
  warning = false,
  danger = false,
}) {
  const color = danger ? colors.danger : warning ? colors.warning : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sheetAction, { borderTopColor: colors.border }]}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.sheetActionText, { color }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function TripReasonModal({ action, colors, saving, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  React.useEffect(() => setReason(""), [action]);
  if (!action) return null;
  const cancelling = action.type === "cancel";
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.reasonSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {cancelling ? "Cancel Trip" : "Archive Trip"}
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
            {cancelling
              ? "Shipments remain in the system and are detached from this trip."
              : "The trip remains available in history and the audit log."}
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            editable={!saving}
            multiline
            placeholder="Reason is required"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.reasonInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.cardMuted,
              },
            ]}
          />
          <View style={styles.modalActions}>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.modalButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                Back
              </Text>
            </Pressable>
            <Pressable
              disabled={saving || !reason.trim()}
              onPress={() => onConfirm(reason.trim())}
              style={[
                styles.modalButton,
                cancelling ? styles.warningButton : styles.dangerButton,
                (saving || !reason.trim()) && styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>
                  {cancelling ? "Cancel Trip" : "Archive Trip"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TripCard({ item, colors, scheduled = false, onActions }) {
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
      {scheduled ? (
        <View style={[styles.schedule, { borderTopColor: colors.border }]}>
          <Fact
            icon="calendar"
            value={`Departure: ${formatDate(
              item.plannedDeparture ||
                item.departure ||
                item.departureAt ||
                item.scheduledDeparture,
            )}`}
            colors={colors}
          />
          <Fact
            icon="clock"
            value={`Estimated arrival: ${formatDate(
              item.estimatedArrival ||
                item.eta ||
                item.estimatedArrivalAt ||
                item.arrivalEstimate,
            )}`}
            colors={colors}
          />
          <Fact
            icon="box"
            value={`Loading: ${formatDate(
              item.plannedLoadingStart || item.loadingStart,
            )} – ${formatDate(item.plannedLoadingEnd || item.loadingEnd)}`}
            colors={colors}
          />
        </View>
      ) : null}
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
  boardScroll: { flex: 1, minHeight: 0 },
  toolbar: { padding: 13, gap: 10 },
  tabs: { flexDirection: "row", borderRadius: 13, padding: 4, gap: 3 },
  tab: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#0f766e" },
  tabText: { fontSize: 11, fontWeight: "800" },
  search: { minHeight: 45, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, padding: 0, fontSize: 13 },
  filterButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filterButtonActive: { backgroundColor: "#0f766e" },
  scheduleButton: { minHeight: 43, borderRadius: 12, backgroundColor: "#0f766e", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  scheduleButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  filters: { borderWidth: 1, borderRadius: 14, padding: 11, gap: 8 },
  filterLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { minHeight: 31, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  filterChipText: { fontSize: 9, fontWeight: "800" },
  dateRow: { flexDirection: "row", gap: 7 },
  dateInput: { flex: 1, minWidth: 0, minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, fontSize: 10 },
  clearFilters: { alignSelf: "flex-end", paddingVertical: 5 },
  clearFiltersText: { color: "#0f766e", fontSize: 10, fontWeight: "900" },
  list: { padding: 14, paddingBottom: 28, gap: 11 },
  emptyList: { flexGrow: 1 },
  upcomingCard: { marginBottom: 2 },
  upcomingHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  upcomingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  upcomingHeadingCopy: { flex: 1 },
  upcomingTitle: { fontSize: 15, fontWeight: "900" },
  upcomingSubtitle: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  departureTabs: { flexDirection: "row", gap: 5, marginTop: 5, marginBottom: 8 },
  departureTab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  departureTabActive: {
    backgroundColor: "#06b981",
    shadowColor: "#06b981",
    shadowOpacity: 0.25,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  departureTabText: { fontSize: 11, fontWeight: "900" },
  upcomingRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  upcomingList: { maxHeight: 350 },
  upcomingDate: { width: 58 },
  upcomingDay: { fontSize: 12, fontWeight: "900" },
  upcomingTime: { fontSize: 9, marginTop: 3 },
  upcomingCopy: { flex: 1, minWidth: 0 },
  upcomingTripId: { fontSize: 12, fontWeight: "900" },
  upcomingMeta: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  upcomingEdit: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  upcomingEmpty: { paddingVertical: 20, textAlign: "center", fontSize: 11 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  moreButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "900" },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  tripFacts: { marginTop: 13, gap: 8 },
  schedule: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
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
  actionBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  actionSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  actionHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#94a3b8", opacity: 0.55, alignSelf: "center", marginBottom: 15 },
  actionSheetTitle: { fontSize: 17, fontWeight: "900" },
  actionSheetMeta: { fontSize: 11, marginTop: 3, marginBottom: 10 },
  sheetAction: { minHeight: 51, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  sheetActionText: { flex: 1, fontSize: 13, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  modalSheet: { maxHeight: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  reasonSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  reasonInput: { minHeight: 96, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, textAlignVertical: "top" },
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
  warningButton: { backgroundColor: "#d97706", borderColor: "#d97706" },
  dangerButton: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  disabled: { opacity: 0.55 },
  cancelText: { fontWeight: "800" },
  saveText: { color: "#fff", fontWeight: "800" },
});
