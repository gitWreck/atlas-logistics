import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import {
  assignCheckerMunicipalities,
  getManagerMobileModules,
  updateInvoiceStatus,
  updateManagerMobileSettings,
  updateTruckStatus,
  updateUserProfile,
  updateUserProfileMobile,
  toggleUserStatus,
} from "../utilities/FirebaseFunctions";
import useManagerRequest from "./useManagerRequest";
import ManagerQuickCreateModal from "./ManagerQuickCreateModal";
import AdminMobileSettingsEditor from "./AdminMobileSettingsEditor";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagerCard,
  ManagerHeader,
  SectionTitle,
  displayName,
  formatDate,
} from "./ManagerUI";

const MODULES = {
  trucks: {
    title: "Trucks",
    subtitle: "Fleet health, assignments, capacity, and maintenance",
    icon: "truck",
    source: "trucks",
  },
  drivers: {
    title: "Drivers",
    subtitle: "Authorized drivers and their current assignments",
    icon: "users",
    source: "staff",
    resourceType: "staff",
    roleFilter: "driver",
  },
  checkers: {
    title: "Checkers",
    subtitle: "Authorized Checkers and municipality coverage",
    icon: "user-check",
    source: "staff",
    resourceType: "staff",
    roleFilter: "checker",
  },
  customers: {
    title: "Customers",
    subtitle: "Accounts, contacts, shipments, and pickup history",
    icon: "users",
    source: "customers",
  },
  warehouses: {
    title: "Warehouses",
    subtitle: "Warehouse locations available to your account",
    icon: "home",
    source: "warehouses",
    resourceType: "warehouses",
  },
  invoices: {
    title: "Invoices",
    subtitle: "Billing records and payment workflow",
    icon: "file-text",
    source: "invoices",
  },
  "delivery-operations": {
    title: "Delivery Operations",
    subtitle: "Current delivery work inside your assigned scope",
    icon: "navigation",
    source: "delivery",
  },
  "pickup-requests": {
    title: "Pickup Requests",
    subtitle: "Pending, assigned, and completed pickups",
    icon: "inbox",
    source: "pickups",
  },
  staff: {
    title: "Staff Management",
    subtitle: "Checkers, Drivers, and warehouse personnel",
    icon: "user-check",
    source: "staff",
  },
  municipalities: {
    title: "Municipality Assignments",
    subtitle: "Checker coverage within your Manager scope",
    icon: "map-pin",
    source: "municipalities",
  },
  reports: {
    title: "Reports",
    subtitle: "Live shipment, delivery, return, and staff summaries",
    icon: "bar-chart-2",
    source: "reports",
  },
  settings: {
    title: "Settings",
    subtitle: "Manager mobile preferences and operational reference data",
    icon: "settings",
    source: "settings",
  },
};

const INVOICE_TRANSITIONS = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "CANCELLED"],
};
const TRUCK_STATUSES = ["IDLE", "IN_TRANSIT", "MAINTENANCE", "OUT_OF_SERVICE"];

function searchable(row = {}) {
  return JSON.stringify(row).toLowerCase();
}

function municipalityList(row = {}) {
  return [
    ...(row.assignedMunicipalities || []),
    ...(row.municipalityCoverage || []),
    row.assignedMunicipality,
    row.municipality,
  ].filter(Boolean);
}

export default function ManagerModuleScreen() {
  const { module } = useLocalSearchParams();
  const key = String(module || "");
  const config = MODULES[key] || MODULES.reports;
  const { colors } = useTheme();
  const { role } = useAuth();
  const isAdmin = ["admin", "administrator"].includes(
    String(role || "").toLowerCase(),
  );
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [actionUser, setActionUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushAlerts, setPushAlerts] = useState(true);
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    getManagerMobileModules,
  );
  useEffect(() => {
    if (data?.preferences) {
      setPushAlerts(data.preferences.pushNotifications !== false);
    }
  }, [data?.preferences]);

  const sourceRows = useMemo(() => {
    if (!data) return [];
    if (config.source === "settings" || config.source === "reports") {
      return [];
    }
    if (config.source === "warehouses") {
      const assigned = (data.scope?.warehouses || [])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      return (data.settings?.warehouses || [])
        .map((warehouse, index) =>
          typeof warehouse === "string"
            ? { id: warehouse, name: warehouse, active: true }
            : {
                id: warehouse.id || warehouse.code || `warehouse-${index}`,
                active: warehouse.active !== false,
                ...warehouse,
              },
        )
        .filter((warehouse) => {
          if (!assigned.length) return true;
          return [warehouse.id, warehouse.code, warehouse.name]
            .map((value) => String(value || "").trim().toLowerCase())
            .some((value) => value && assigned.includes(value));
        });
    }
    if (config.source === "delivery") {
      return (data.shipments || []).filter((row) =>
        ["OUT_FOR_DELIVERY", "FAILED", "FAILED_DELIVERY", "DELIVERED", "RETURNED"]
          .some((value) => String(row.status || "").toUpperCase().startsWith(value)),
      );
    }
    if (config.source === "municipalities") {
      return (data.staff || []).filter(
        (row) => String(row.role || "").toLowerCase() === "checker",
      );
    }
    if (key === "staff" && isAdmin) {
      const seen = new Set();
      return [...(data.staff || []), ...(data.customers || [])].filter(
        (row) => {
          const id = String(row.uid || row.id || row.email || "");
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        },
      );
    }
    const values = data[config.source] || [];
    if (config.roleFilter) {
      return values.filter(
        (row) =>
          String(row.role || "").toLowerCase() === config.roleFilter,
      );
    }
    return values;
  }, [config.roleFilter, config.source, data, isAdmin, key]);

  const statuses = useMemo(
    () => [
      "ALL",
      ...new Set(
        sourceRows
          .map((row) =>
            String(
              key === "staff" && isAdmin
                ? row.role
                : row.status || row.employmentStatus || "",
            ).toUpperCase(),
          )
          .filter(Boolean),
      ),
    ].slice(0, 7),
    [config.source, isAdmin, key, sourceRows],
  );
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceRows.filter((row) => {
      const rowStatus = String(
        key === "staff" && isAdmin
          ? row.role
          : row.status || row.employmentStatus || "",
      ).toUpperCase();
      return (
        (status === "ALL" || rowStatus === status) &&
        (!term || searchable(row).includes(term))
      );
    });
  }, [config.source, isAdmin, key, search, sourceRows, status]);
  const resourceType = config.resourceType || config.source;
  const invoiceSummary = useMemo(() => {
    const invoices = data?.invoices || [];
    const activeShipmentInvoiceIds = new Set(
      invoices
        .filter(
          (invoice) =>
            String(invoice.status || "DRAFT").toUpperCase() !== "CANCELLED",
        )
        .map((invoice) => String(invoice.shipmentId || ""))
        .filter(Boolean),
    );
    const count = (value) =>
      invoices.filter(
        (invoice) =>
          String(invoice.status || "DRAFT").toUpperCase() === value,
      ).length;
    return {
      total: invoices.length,
      draft: count("DRAFT"),
      issued: count("ISSUED"),
      paid: count("PAID"),
      cancelled: count("CANCELLED"),
      eligible: (data?.shipments || []).filter(
        (shipment) =>
          !shipment.archived &&
          String(shipment.status || "").toUpperCase() !== "CANCELLED" &&
          !activeShipmentInvoiceIds.has(String(shipment.id || "")),
      ).length,
    };
  }, [data?.invoices, data?.shipments]);

  if (loading) return <LoadingState label={`Loading ${config.title.toLowerCase()}…`} />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const perform = async (label, callback) => {
    try {
      setSaving(true);
      await callback();
      setSelected(null);
      await reload({ refresh: true });
      return true;
    } catch (nextError) {
      Alert.alert(`${label} failed`, nextError.message || "Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const exportInvoices = async () => {
    try {
      const escapeCsv = (value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [
        [
          "Invoice",
          "Shipment",
          "Sender",
          "Recipient",
          "Route",
          "Amount",
          "Due Date",
          "Status",
        ]
          .map(escapeCsv)
          .join(","),
        ...(data?.invoices || []).map((invoice) =>
          [
            invoice.invoiceNumber || invoice.id,
            invoice.shipmentTrackingNumber || invoice.shipmentId,
            invoice.senderName || invoice.billingName,
            invoice.recipientName,
            invoice.routeLabel ||
              [invoice.origin, invoice.destination].filter(Boolean).join(" → "),
            Number(invoice.amount || 0),
            invoice.dueDate || "",
            invoice.status || "DRAFT",
          ]
            .map(escapeCsv)
            .join(","),
        ),
      ].join("\n");
      const filename = `Atlas_Invoices_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      const uri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          dialogTitle: "Export invoices",
        });
      }
    } catch (nextError) {
      Alert.alert(
        "Export failed",
        nextError.message || "Unable to export invoices.",
      );
    }
  };

  if (key === "reports") {
    return (
      <ReportView
        config={config}
        data={data}
        colors={colors}
        refreshing={refreshing}
        reload={reload}
      />
    );
  }
  if (key === "settings") {
    return (
      <SettingsView
        config={config}
        data={data}
        colors={colors}
        pushAlerts={pushAlerts}
        setPushAlerts={setPushAlerts}
        reload={reload}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title={key === "staff" && isAdmin ? "User Management" : config.title}
        subtitle={
          key === "staff" && isAdmin
            ? "Manage user accounts, roles, status, and access"
            : config.subtitle
        }
        actionIcon={
          ["trucks", "customers", "invoices"].includes(config.source) ||
          (key === "staff" && isAdmin)
            ? "plus"
            : undefined
        }
        onAction={() => setCreateVisible(true)}
      />
      <FlatList
        style={styles.moduleList}
        data={rows}
        keyExtractor={(item, index) => item.id || `${key}-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#4f46e5"
          />
        }
        contentContainerStyle={rows.length ? styles.list : styles.emptyList}
        ListHeaderComponentStyle={rows.length ? styles.scrollingToolbarHeader : undefined}
        ListHeaderComponent={
          <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
            {config.source === "invoices" ? (
              <InvoiceMobileOverview
                summary={invoiceSummary}
                colors={colors}
                onExport={exportInvoices}
                onRefresh={() => reload({ refresh: true })}
              />
            ) : null}
            <View style={[styles.search, { backgroundColor: colors.cardMuted }]}>
              <Feather name="search" size={17} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
            placeholder={
              key === "staff" && isAdmin
                ? "Search name, email, or ID"
                : `Search ${config.title.toLowerCase()}`
            }
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            {statuses.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chips}>
                  {statuses.map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setStatus(value)}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        status === value && styles.chipActive,
                      ]}
                    >
                      <Text style={[styles.chipText, { color: status === value ? "#fff" : colors.textMuted }]}>
                        {value.replace(/_/g, " ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (config.source === "delivery" || config.source === "pickups") {
                router.push({
                  pathname: "/(manager)/shipment-details",
                  params: { shipmentId: item.id },
                });
              } else if (key === "staff" && isAdmin) {
                setActionUser(item);
              } else {
                setSelected(item);
              }
            }}
          >
            <ResourceCard
              type={resourceType}
              item={item}
              colors={colors}
              showMore={
                (key === "staff" && isAdmin) ||
                config.source === "customers" ||
                config.source === "invoices"
              }
              onMore={(event) => {
                event?.stopPropagation?.();
                if (key === "staff" && isAdmin) {
                  setActionUser(item);
                } else {
                  setSelected(item);
                }
              }}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={config.icon}
            title={`No ${config.title.toLowerCase()} found`}
            message="Only records authorized for your warehouse and municipalities are shown."
          />
        }
      />
      <DetailSheet
        type={resourceType}
        item={selected}
        data={data}
        colors={colors}
        isAdmin={isAdmin}
        saving={saving}
        onClose={() => !saving && setSelected(null)}
        onTruckStatus={(nextStatus) =>
          perform("Truck update", () =>
            updateTruckStatus({
              truckId: selected.id,
              status: nextStatus,
              plateNumber: selected.plateNumber,
            }),
          )
        }
        onInvoiceStatus={(nextStatus) =>
          perform("Invoice update", () =>
            updateInvoiceStatus({
              invoiceId: selected.id,
              status: nextStatus,
              sendNotification: true,
            }),
          )
        }
        onMunicipalities={(municipalities) =>
          perform("Assignment", () =>
            assignCheckerMunicipalities({
              checkerId: selected.id,
              municipalities,
            }),
          )
        }
        onCustomerUpdate={(payload) =>
          perform("Customer update", () => updateUserProfileMobile(payload))
        }
        onAdminUserUpdate={(payload) =>
          perform("User update", () => updateUserProfile(payload))
        }
        onAdminUserDelete={(shouldDisable) =>
          perform(shouldDisable ? "Delete user" : "Restore user", () =>
            toggleUserStatus({
              uid: selected.uid || selected.id,
              shouldDisable,
            }),
          )
        }
      />
      <ManagerQuickCreateModal
        type={config.source}
        visible={createVisible}
        scope={data?.scope}
        settings={data?.settings}
        shipments={data?.shipments || []}
        onClose={() => setCreateVisible(false)}
        onCreated={() => reload({ refresh: true })}
      />
      <AdminUserActionMenu
        user={actionUser}
        colors={colors}
        saving={saving}
        onClose={() => !saving && setActionUser(null)}
        onEdit={() => {
          setEditingUser(actionUser);
          setActionUser(null);
        }}
        onDelete={async () => {
          if (!actionUser) return;
          const disabled =
            actionUser.active === false ||
            ["inactive", "suspended", "disabled"].includes(
              String(actionUser.status || "").toLowerCase(),
            );
          const updated = await perform(
            disabled ? "Restore user" : "Delete user",
            () =>
              toggleUserStatus({
                uid: actionUser.uid || actionUser.id,
                shouldDisable: !disabled,
              }),
          );
          if (updated) setActionUser(null);
        }}
      />
      {editingUser ? (
        <AdminEditUserModal
          visible
          user={editingUser}
          settings={data?.settings}
          colors={colors}
          saving={saving}
          onClose={() => !saving && setEditingUser(null)}
          onSave={async (payload) => {
            const updated = await perform("User update", () =>
              updateUserProfile(payload),
            );
            if (updated) setEditingUser(null);
          }}
        />
      ) : null}
    </View>
  );
}

function InvoiceMobileOverview({ summary, colors, onExport, onRefresh }) {
  const cards = [
    ["Total", summary.total, "file-text", "#4f46e5", "#eef2ff"],
    ["Draft", summary.draft, "edit-3", "#d97706", "#fffbeb"],
    ["Issued", summary.issued, "file-text", "#0284c7", "#f0f9ff"],
    ["Paid", summary.paid, "check-circle", "#059669", "#ecfdf5"],
    ["Cancelled", summary.cancelled, "slash", "#dc2626", "#fef2f2"],
    ["Eligible Shipments", summary.eligible, "truck", "#2563eb", "#eff6ff"],
  ];
  return (
    <View style={styles.invoiceOverview}>
      <View style={styles.invoiceStatsGrid}>
        {cards.map(([label, value, icon, color, background]) => (
          <View
            key={label}
            style={[
              styles.invoiceStatCard,
              { backgroundColor: colors.cardMuted, borderColor: color },
            ]}
          >
            <View style={styles.cardCopy}>
              <Text style={[styles.invoiceStatLabel, { color }]}>{label}</Text>
              <Text style={[styles.invoiceStatValue, { color: colors.text }]}>
                {value}
              </Text>
            </View>
            <View style={[styles.invoiceStatIcon, { backgroundColor: background }]}>
              <Feather name={icon} size={17} color={color} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.invoiceTools}>
        <Text style={[styles.invoiceToolsTitle, { color: colors.text }]}>
          Invoices
        </Text>
        <Pressable onPress={onExport} style={styles.invoiceExportButton}>
          <Feather name="download" size={15} color="#fff" />
          <Text style={styles.invoiceExportText}>Export CSV</Text>
        </Pressable>
        <Pressable
          onPress={onRefresh}
          style={[styles.invoiceRefreshButton, { borderColor: colors.border }]}
        >
          <Feather name="refresh-cw" size={17} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function ResourceCard({
  type,
  item,
  colors,
  showMore,
  onMore,
}) {
  const title =
    type === "trucks"
      ? item.plateNumber
      : type === "warehouses"
        ? item.name || item.code || item.id
      : type === "invoices"
        ? item.invoiceNumber || item.id
        : type === "staff" || type === "municipalities"
          ? displayName(item)
          : type === "customers"
            ? displayName(item)
            : item.trackingNumber || item.shipmentId || item.id;
  const subtitle =
    type === "trucks"
      ? [item.model, item.type, item.payloadCapacity ? `${item.payloadCapacity} kg` : null]
      : type === "warehouses"
        ? [item.code, item.address, item.municipality || item.city]
      : type === "invoices"
        ? [item.billingName, item.shipmentTrackingNumber, `₱${Number(item.amount || 0).toLocaleString()}`]
        : type === "staff" || type === "municipalities"
          ? [item.role, item.warehouseName || item.warehouseCode, municipalityList(item).join(", ")]
          : type === "customers"
            ? [item.email, item.phone || item.phoneNumber]
            : [displayName(item.sender), displayName(item.recipient), item.municipality];
  const status = item.status || item.employmentStatus || (item.active === false ? "INACTIVE" : "ACTIVE");
  return (
    <ManagerCard>
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {title || "Record"}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle.filter(Boolean).join(" • ") || "No additional details"}
          </Text>
        </View>
        <View style={styles.cardTrailing}>
          <StatusBadge status={status} />
          {showMore ? (
            <Pressable
              accessibilityLabel={`Open actions for ${title || "record"}`}
              hitSlop={8}
              onPress={onMore}
              style={[styles.moreButton, { backgroundColor: colors.cardMuted }]}
            >
              <Feather name="more-vertical" size={19} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {item.currentTripId || item.assignedTripId ? (
        <Text style={[styles.assignment, { color: colors.textMuted }]}>
          Current trip: {item.currentTripId || item.assignedTripId}
        </Text>
      ) : null}
      {!showMore ? (
        <View style={styles.openRow}>
          <Text style={styles.openText}>View details</Text>
          <Feather name="chevron-right" size={17} color="#4f46e5" />
        </View>
      ) : null}
    </ManagerCard>
  );
}

function AdminUserActionMenu({
  user,
  colors,
  saving,
  onClose,
  onEdit,
  onDelete,
}) {
  if (!user) return null;
  const disabled =
    user.active === false ||
    ["inactive", "suspended", "disabled"].includes(
      String(user.status || "").toLowerCase(),
    );
  const publicId =
    user.publicId || user.userCode || user.driverCode || user.id || "N/A";
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.userMenuBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.userMenuSheet, { backgroundColor: colors.surface }]}
        >
          <View style={styles.userMenuHeader}>
            <View style={styles.cardCopy}>
              <Text style={[styles.userMenuTitle, { color: colors.text }]}>
                {displayName(user)}
              </Text>
              <Text style={[styles.userMenuMeta, { color: colors.textMuted }]}>
                {String(user.role || "user").toUpperCase()} · {publicId}
              </Text>
            </View>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.cardMuted }]}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Pressable
            disabled={saving}
            onPress={onEdit}
            style={[
              styles.userMenuAction,
              {
                backgroundColor: colors.cardMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.userMenuIcon, { backgroundColor: "#dbeafe" }]}>
              <Feather name="edit-2" size={18} color="#2563eb" />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.userMenuActionTitle, { color: colors.text }]}>
                Edit User Details
              </Text>
              <Text
                style={[styles.userMenuActionMeta, { color: colors.textMuted }]}
              >
                Update profile, role, warehouse, status, or password
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            disabled={saving}
            onPress={() =>
              Alert.alert(
                disabled ? "Restore user?" : "Delete user access?",
                disabled
                  ? `Restore login access for ${displayName(user)}?`
                  : `This disables ${displayName(user)} and prevents login while preserving operational records.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: disabled ? "Restore User" : "Delete User",
                    style: disabled ? "default" : "destructive",
                    onPress: onDelete,
                  },
                ],
              )
            }
            style={[
              styles.userMenuAction,
              {
                backgroundColor: colors.cardMuted,
                borderColor: disabled ? "#a7f3d0" : "#fecaca",
              },
            ]}
          >
            <View
              style={[
                styles.userMenuIcon,
                { backgroundColor: disabled ? "#d1fae5" : "#fee2e2" },
              ]}
            >
              <Feather
                name={disabled ? "user-check" : "trash-2"}
                size={18}
                color={disabled ? "#059669" : "#ef4444"}
              />
            </View>
            <View style={styles.cardCopy}>
              <Text
                style={[
                  styles.userMenuActionTitle,
                  { color: disabled ? "#059669" : "#ef4444" },
                ]}
              >
                {disabled ? "Restore User" : "Delete User"}
              </Text>
              <Text
                style={[styles.userMenuActionMeta, { color: colors.textMuted }]}
              >
                {disabled
                  ? "Allow this user to sign in again"
                  : "Disable login while retaining operational history"}
              </Text>
            </View>
            {saving ? (
              <ActivityIndicator
                color={disabled ? "#059669" : "#ef4444"}
                size="small"
              />
            ) : (
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailSheet({
  type,
  item,
  data,
  colors,
  isAdmin,
  saving,
  onClose,
  onTruckStatus,
  onInvoiceStatus,
  onMunicipalities,
  onCustomerUpdate,
  onAdminUserUpdate,
  onAdminUserDelete,
}) {
  const [municipalities, setMunicipalities] = useState([]);
  const [customerEditVisible, setCustomerEditVisible] = useState(false);
  const [userEditVisible, setUserEditVisible] = useState(false);
  const [customerTab, setCustomerTab] = useState("details");
  React.useEffect(() => {
    setMunicipalities(municipalityList(item || {}));
    setCustomerTab("details");
  }, [item]);
  if (!item) return null;
  const fields = Object.entries(item)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .filter(([field]) => !["photoURL", "profilePhoto"].includes(field))
    .slice(0, 18);
  const allowedMunicipalities = data?.scope?.municipalities || [];
  const nextInvoiceStatuses = INVOICE_TRANSITIONS[String(item.status || "DRAFT").toUpperCase()] || [];
  const relatedShipments =
    type === "customers"
      ? (data?.shipments || []).filter((shipment) =>
          [
            shipment.customerId,
            shipment.customerUid,
            shipment.userId,
            shipment.senderId,
            shipment.sender?.id,
            shipment.sender?.uid,
            shipment.sender?.email,
          ]
            .filter(Boolean)
            .map(String)
            .some((value) =>
              [item.id, item.uid, item.email].filter(Boolean).map(String).includes(value),
            ),
        )
      : [];
  const relatedPickups =
    type === "customers"
      ? (data?.pickups || []).filter((shipment) =>
          [shipment.customerId, shipment.customerUid, shipment.userId, shipment.senderId]
            .filter(Boolean)
            .map(String)
            .includes(String(item.id)),
        )
      : [];
  const relatedShipmentIds = new Set(
    relatedShipments
      .flatMap((shipment) => [
        shipment.id,
        shipment.shipmentId,
        shipment.trackingNumber,
      ])
      .filter(Boolean)
      .map(String),
  );
  const relatedInvoices =
    type === "customers"
      ? (data?.invoices || []).filter((invoice) => {
          const directValues = [
            invoice.customerId,
            invoice.customerUid,
            invoice.customerEmail,
            invoice.billingEmail,
          ]
            .filter(Boolean)
            .map(String);
          const customerValues = [item.id, item.uid, item.email]
            .filter(Boolean)
            .map(String);
          return (
            directValues.some((value) => customerValues.includes(value)) ||
            relatedShipmentIds.has(String(invoice.shipmentId || ""))
          );
        })
      : [];
  const customerAddress = [
    item.address?.unit,
    item.address?.street,
    item.address?.barangay,
    item.address?.city,
    item.address?.province,
  ]
    .filter(Boolean)
    .join(", ");
  const isSelectedUserDisabled =
    item.active === false ||
    ["inactive", "suspended", "disabled"].includes(
      String(item.status || "").toLowerCase(),
    );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetTop}>
            <View style={styles.cardCopy}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {item.plateNumber ||
                  item.invoiceNumber ||
                  item.name ||
                  item.code ||
                  displayName(item) ||
                  item.id}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
                {type === "customers"
                  ? `Customer details · ${
                      item.publicId ||
                      item.userCode ||
                      item.customerCode ||
                      item.id
                    }`
                  : type === "staff" && isAdmin
                    ? `${String(item.role || "user").toUpperCase()} · ${
                        isSelectedUserDisabled ? "INACTIVE" : "ACTIVE"
                      }`
                    : "Authorized Manager record"}
              </Text>
            </View>
            <Pressable onPress={onClose} style={[styles.close, { backgroundColor: colors.cardMuted }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetScroll}>
            {type !== "customers"
              ? fields.map(([field, value]) => (
                  <View
                    key={field}
                    style={[
                      styles.detailRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[styles.detailLabel, { color: colors.textMuted }]}
                    >
                      {field.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {String(value)}
                    </Text>
                  </View>
                ))
              : null}
            {type === "customers" ? (
              <View>
                <View
                  style={[
                    styles.customerTabs,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  {[
                    ["details", "user", "Details"],
                    ["shipments", "package", `Shipments (${relatedShipments.length})`],
                    ["invoices", "file-text", `Invoices (${relatedInvoices.length})`],
                  ].map(([value, icon, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => setCustomerTab(value)}
                      style={[
                        styles.customerTab,
                        customerTab === value && styles.customerTabActive,
                      ]}
                    >
                      <Feather
                        name={icon}
                        size={14}
                        color={
                          customerTab === value ? "#059669" : colors.textMuted
                        }
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.customerTabText,
                          {
                            color:
                              customerTab === value
                                ? "#059669"
                                : colors.textMuted,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.actionSection}>
                  {customerTab === "details" ? (
                    <>
                      {isAdmin && (
                        <Pressable
                          onPress={() => setCustomerEditVisible(true)}
                          style={styles.editCustomerButton}
                        >
                          <Feather name="edit-2" size={16} color="#fff" />
                          <Text style={styles.editCustomerButtonText}>
                            Edit Customer
                          </Text>
                        </Pressable>
                      )}
                      <View style={styles.customerDetailGrid}>
                        {[
                          [
                            "credit-card",
                            "Customer ID",
                            item.publicId ||
                              item.userCode ||
                              item.customerCode ||
                              item.id,
                          ],
                          ["user", "Name", displayName(item)],
                          ["mail", "Email", item.email || "N/A"],
                          [
                            "phone",
                            "Phone",
                            item.phoneNumber || item.phone || "N/A",
                          ],
                        ].map(([icon, label, value]) => (
                          <View
                            key={label}
                            style={[
                              styles.customerDetailCard,
                              {
                                backgroundColor: colors.cardMuted,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.detailLabel,
                                { color: colors.textMuted },
                              ]}
                            >
                              {label}
                            </Text>
                            <View style={styles.customerDetailValueRow}>
                              <Feather
                                name={icon}
                                size={15}
                                color={colors.textMuted}
                              />
                              <Text
                                style={[
                                  styles.customerDetailValue,
                                  { color: colors.text },
                                ]}
                                numberOfLines={2}
                              >
                                {String(value || "N/A")}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                      <View
                        style={[
                          styles.customerAddressCard,
                          {
                            backgroundColor: colors.cardMuted,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailLabel,
                            { color: colors.textMuted },
                          ]}
                        >
                          Address
                        </Text>
                        <View style={styles.customerDetailValueRow}>
                          <Feather
                            name="map-pin"
                            size={15}
                            color={colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.customerDetailValue,
                              { color: colors.text },
                            ]}
                          >
                            {customerAddress || "N/A"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.actionTitle,
                          { color: colors.text, marginTop: 18 },
                        ]}
                      >
                        Account activity
                      </Text>
                      {[
                        ["Created", formatDate(item.createdAt)],
                        ["Last login", formatDate(item.lastLoginAt)],
                        ["Updated", formatDate(item.updatedAt)],
                      ].map(([label, value]) => (
                        <InfoLine
                          key={label}
                          label={label}
                          value={value || "N/A"}
                          colors={colors}
                        />
                      ))}
                    </>
                  ) : null}
                  {customerTab === "shipments" ? (
                    <>
                      {[...relatedShipments, ...relatedPickups]
                        .slice(0, 30)
                        .map((shipment) => (
                          <View
                            key={shipment.id}
                            style={[
                              styles.relatedRow,
                              { borderBottomColor: colors.border },
                            ]}
                          >
                            <View style={styles.cardCopy}>
                              <Text
                                style={[
                                  styles.cardTitle,
                                  { color: colors.text },
                                ]}
                              >
                                {shipment.trackingNumber ||
                                  shipment.shipmentId ||
                                  shipment.id}
                              </Text>
                              <Text
                                style={[
                                  styles.cardMeta,
                                  { color: colors.textMuted },
                                ]}
                              >
                                {formatDate(shipment.updatedAt)}
                              </Text>
                            </View>
                            <StatusBadge status={shipment.status} />
                          </View>
                        ))}
                      {!relatedShipments.length && !relatedPickups.length ? (
                        <Text
                          style={[
                            styles.customerEmptyText,
                            { color: colors.textMuted },
                          ]}
                        >
                          No shipments found for this customer.
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                  {customerTab === "invoices" ? (
                    <>
                      {relatedInvoices.slice(0, 30).map((invoice) => (
                        <View
                          key={invoice.id}
                          style={[
                            styles.relatedRow,
                            { borderBottomColor: colors.border },
                          ]}
                        >
                          <View style={styles.cardCopy}>
                            <Text
                              style={[
                                styles.cardTitle,
                                { color: colors.text },
                              ]}
                            >
                              {invoice.invoiceNumber || invoice.id}
                            </Text>
                            <Text
                              style={[
                                styles.cardMeta,
                                { color: colors.textMuted },
                              ]}
                            >
                              ₱{Number(invoice.amount || 0).toLocaleString()}
                            </Text>
                          </View>
                          <StatusBadge status={invoice.status} />
                        </View>
                      ))}
                      {!relatedInvoices.length ? (
                        <Text
                          style={[
                            styles.customerEmptyText,
                            { color: colors.textMuted },
                          ]}
                        >
                          No invoices found for this customer.
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}
            {type === "staff" && isAdmin ? (
              <View style={styles.actionSection}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Admin actions
                </Text>
                <View style={styles.adminUserActions}>
                  <Pressable
                    disabled={saving}
                    onPress={() => setUserEditVisible(true)}
                    style={[styles.adminUserButton, styles.adminUserEdit]}
                  >
                    <Feather name="edit-2" size={16} color="#2563eb" />
                    <Text style={styles.adminUserEditText}>Edit User</Text>
                  </Pressable>
                  <Pressable
                    disabled={saving}
                    onPress={() => {
                      const shouldDisable =
                        item.active !== false &&
                        !["inactive", "suspended", "disabled"].includes(
                          String(item.status || "").toLowerCase(),
                        );
                      Alert.alert(
                        shouldDisable ? "Delete user access?" : "Restore user?",
                        shouldDisable
                          ? `This disables ${displayName(item)} and prevents login while preserving operational records.`
                          : `This restores login access for ${displayName(item)}.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: shouldDisable ? "Delete User" : "Restore User",
                            style: shouldDisable ? "destructive" : "default",
                            onPress: () => onAdminUserDelete(shouldDisable),
                          },
                        ],
                      );
                    }}
                    style={[
                      styles.adminUserButton,
                      isSelectedUserDisabled
                        ? styles.adminUserRestore
                        : styles.adminUserDelete,
                      { backgroundColor: colors.cardMuted },
                    ]}
                  >
                    <Feather
                      name={isSelectedUserDisabled ? "user-check" : "trash-2"}
                      size={16}
                      color={isSelectedUserDisabled ? "#059669" : "#ef4444"}
                    />
                    <Text
                      style={
                        isSelectedUserDisabled
                          ? styles.adminUserRestoreText
                          : styles.adminUserDeleteText
                      }
                    >
                      {isSelectedUserDisabled ? "Restore User" : "Delete User"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {type === "trucks" ? (
              <ActionSection title="Update truck status" values={TRUCK_STATUSES} current={item.status} onPress={onTruckStatus} />
            ) : null}
            {type === "invoices" && nextInvoiceStatuses.length ? (
              <ActionSection title="Invoice actions" values={nextInvoiceStatuses} current={item.status} onPress={onInvoiceStatus} />
            ) : null}
            {(type === "staff" || type === "municipalities") &&
            String(item.role || "").toLowerCase() === "checker" ? (
              <View style={styles.actionSection}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Municipality assignment</Text>
                <View style={styles.wrap}>
                  {allowedMunicipalities.map((value) => {
                    const active = municipalities.includes(value);
                    return (
                      <Pressable
                        key={value}
                        onPress={() =>
                          setMunicipalities((current) =>
                            active ? current.filter((entry) => entry !== value) : [...current, value],
                          )
                        }
                        style={[styles.actionChip, active && styles.actionChipActive]}
                      >
                        <Text style={[styles.actionChipText, active && { color: "#fff" }]}>{value}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  disabled={saving || !municipalities.length}
                  style={[styles.primary, (saving || !municipalities.length) && styles.disabled]}
                  onPress={() => onMunicipalities(municipalities)}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save assignment</Text>}
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
          {type === "customers" ? (
            <CustomerEditModal
              visible={customerEditVisible}
              customer={item}
              settings={data?.settings}
              scope={data?.scope}
              colors={colors}
              saving={saving}
              onClose={() => !saving && setCustomerEditVisible(false)}
              onSave={onCustomerUpdate}
            />
          ) : null}
          {type === "staff" && isAdmin ? (
            <AdminEditUserModal
              visible={userEditVisible}
              user={item}
              settings={data?.settings}
              colors={colors}
              saving={saving}
              onClose={() => !saving && setUserEditVisible(false)}
              onSave={onAdminUserUpdate}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function AdminEditUserModal({
  visible,
  user,
  settings,
  colors,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    if (!visible || !user) return;
    const address = user.address || {};
    setForm({
      uid: user.uid || user.id,
      publicId:
        user.publicId || user.userCode || user.driverCode || user.id || "",
      displayName: displayName(user),
      email: user.email || "",
      phoneNumber: user.phoneNumber || user.phone || "",
      role: String(user.role || "driver").toLowerCase(),
      status:
        user.active === false ||
        ["inactive", "suspended", "disabled"].includes(
          String(user.status || "").toLowerCase(),
        )
          ? "inactive"
          : "active",
      password: "",
      warehouseCode: user.warehouseCode || user.assignedWarehouseCode || "",
      warehouseName: user.warehouseName || user.assignedWarehouse || "",
      province: address.province || user.province || "",
      city: address.city || user.city || "",
      barangay: address.barangay || user.barangay || "",
      street: address.street || user.street || "",
    });
    setShowPassword(false);
  }, [user, visible]);

  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const warehouses = (settings?.warehouses || []).map((warehouse) =>
    typeof warehouse === "string"
      ? { code: warehouse, name: warehouse }
      : warehouse,
  );
  const warehouseOptions = warehouses
    .map((warehouse) => ({
      value: warehouse.code || warehouse.id || warehouse.name,
      label: warehouse.name || warehouse.code,
    }))
    .filter((warehouse) => warehouse.value);
  const phLocations =
    settings?.phLocations && typeof settings.phLocations === "object"
      ? settings.phLocations
      : {};
  const provinceOptions = Object.keys(phLocations).sort();
  const cityOptions = (phLocations[form.province] || [])
    .map((city) => (typeof city === "string" ? city : city.name))
    .filter(Boolean);

  const save = async () => {
    if (
      !form.uid ||
      !form.displayName?.trim() ||
      !form.email?.trim() ||
      (form.password && form.password.length < 6)
    ) {
      Alert.alert(
        "Invalid user details",
        "Name and email are required. A new password must contain at least 6 characters.",
      );
      return;
    }
    const selectedWarehouse = warehouses.find(
      (warehouse) =>
        String(warehouse.code || warehouse.id || warehouse.name) ===
        String(form.warehouseCode || ""),
    );
    await onSave({
      uid: form.uid,
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      role: form.role,
      status: form.status,
      password: form.password || undefined,
      warehouseCode: form.role === "customer" ? "" : form.warehouseCode,
      warehouseName:
        form.role === "customer"
          ? ""
          : selectedWarehouse?.name || form.warehouseName || "",
      province: form.province,
      city: form.city,
      barangay: form.barangay.trim(),
      street: form.street.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.customerEditBackdrop}>
        <View
          style={[
            styles.customerEditSheet,
            { backgroundColor: colors.surface },
          ]}
        >
          <View
            style={[
              styles.customerEditHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.customerEditTitleRow}>
              <Feather name="edit-2" size={18} color="#2563eb" />
              <Text style={[styles.customerEditTitle, { color: colors.text }]}>
                Edit User
              </Text>
            </View>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.cardMuted }]}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.customerEditScroll}
            contentContainerStyle={styles.customerEditForm}
            keyboardShouldPersistTaps="handled"
          >
            <EditField
              label="User ID"
              value={String(form.publicId || "")}
              editable={false}
              colors={colors}
            />
            <EditField
              label="Full Name *"
              value={form.displayName || ""}
              onChangeText={(value) => set("displayName", value)}
              colors={colors}
            />
            <EditField
              label="Phone Number"
              value={form.phoneNumber || ""}
              onChangeText={(value) => set("phoneNumber", value)}
              keyboardType="phone-pad"
              colors={colors}
            />
            <EditField
              label="Email Address *"
              value={form.email || ""}
              onChangeText={(value) => set("email", value)}
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />
            <View style={styles.editTwoColumns}>
              <View style={styles.editHalf}>
                <EditSelect
                  label="Role"
                  value={form.role}
                  options={[
                    { value: "driver", label: "Driver" },
                    { value: "checker", label: "Checker" },
                    { value: "manager", label: "Manager" },
                    { value: "admin", label: "Admin" },
                    { value: "customer", label: "Customer" },
                  ]}
                  onChange={(value) => set("role", value)}
                  colors={colors}
                />
              </View>
              <View style={styles.editHalf}>
                <EditSelect
                  label="Status"
                  value={form.status}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  onChange={(value) => set("status", value)}
                  colors={colors}
                />
              </View>
            </View>
            {form.role !== "customer" ? (
              <EditSelect
                label="Assign Warehouse Base"
                value={form.warehouseCode}
                options={
                  warehouseOptions.length
                    ? warehouseOptions
                    : [
                        {
                          value: form.warehouseCode,
                          label: form.warehouseName || form.warehouseCode,
                        },
                      ].filter((option) => option.value)
                }
                onChange={(value) => set("warehouseCode", value)}
                colors={colors}
              />
            ) : null}
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>
                RESET PASSWORD (OPTIONAL)
              </Text>
              <View
                style={[
                  styles.editPassword,
                  {
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  value={form.password || ""}
                  onChangeText={(value) => set("password", value)}
                  secureTextEntry={!showPassword}
                  placeholder="Leave blank to keep current"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.editPasswordInput, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.editPasswordEye}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={19}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              <Text style={[styles.editHelp, { color: colors.textMuted }]}>
                Min. 6 characters. The user must use the new password at their
                next login.
              </Text>
            </View>
            {form.role === "customer" ? (
              <View
                style={[styles.editAddress, { borderTopColor: colors.border }]}
              >
                <Text style={styles.editAddressTitle}>Address Details</Text>
                <View style={styles.editTwoColumns}>
                  <View style={styles.editHalf}>
                    <EditSelect
                      label="Province"
                      value={form.province}
                      options={
                        provinceOptions.length
                          ? provinceOptions
                          : [form.province].filter(Boolean)
                      }
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          province: value,
                          city: "",
                        }))
                      }
                      colors={colors}
                    />
                  </View>
                  <View style={styles.editHalf}>
                    <EditSelect
                      label="City / Municipality"
                      value={form.city}
                      options={
                        cityOptions.length
                          ? cityOptions
                          : [form.city].filter(Boolean)
                      }
                      onChange={(value) => set("city", value)}
                      colors={colors}
                    />
                  </View>
                </View>
                <View style={styles.editTwoColumns}>
                  <View style={styles.editHalf}>
                    <EditField
                      label="Barangay"
                      value={form.barangay || ""}
                      onChangeText={(value) => set("barangay", value)}
                      colors={colors}
                    />
                  </View>
                  <View style={styles.editHalf}>
                    <EditField
                      label="Street Name"
                      value={form.street || ""}
                      onChangeText={(value) => set("street", value)}
                      colors={colors}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>
          <View
            style={[
              styles.customerEditActions,
              { borderTopColor: colors.border },
            ]}
          >
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.editButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.editCancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={save}
              style={[
                styles.editButton,
                styles.editSave,
                saving && styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#fff" />
                  <Text style={styles.editSaveText}>Save User</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CustomerEditModal({
  visible,
  customer,
  settings,
  scope,
  colors,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  React.useEffect(() => {
    if (!visible || !customer) return;
    const address = customer.address || {};
    setForm({
      targetUid: customer.uid || customer.id,
      publicId:
        customer.publicId ||
        customer.userCode ||
        customer.customerCode ||
        customer.id ||
        "",
      name: displayName(customer),
      phoneNumber: customer.phoneNumber || customer.phone || "",
      email: customer.email || "",
      status:
        customer.active === false ||
        String(customer.status || "").toLowerCase() === "inactive"
          ? "inactive"
          : "active",
      password: "",
      province: address.province || customer.province || "",
      city: address.city || customer.city || "",
      barangay: address.barangay || customer.barangay || "",
      street: address.street || customer.street || "",
      unit: address.unit || customer.unit || "",
    });
    setShowPassword(false);
  }, [visible, customer]);

  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const phLocations =
    settings?.phLocations && typeof settings.phLocations === "object"
      ? settings.phLocations
      : {};
  const provinceOptions = Object.keys(phLocations).sort();
  const rawCities = phLocations[form.province] || [];
  const configuredCities = rawCities
    .map((city) => (typeof city === "string" ? city : city.name))
    .filter(Boolean);
  const cityOptions = configuredCities.length
    ? configuredCities
    : (scope?.municipalities || []).map(String).filter(Boolean);

  const save = async () => {
    if (
      !form.targetUid ||
      !form.name?.trim() ||
      !form.email?.trim() ||
      (form.password && form.password.length < 6)
    ) {
      Alert.alert(
        "Invalid customer details",
        "Name and email are required. A new password must contain at least 6 characters.",
      );
      return;
    }
    await onSave({
      targetUid: form.targetUid,
      name: form.name.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      status: form.status,
      password: form.password || undefined,
      address: {
        unit: form.unit.trim(),
        street: form.street.trim(),
        barangay: form.barangay.trim(),
        city: form.city,
        province: form.province,
      },
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.customerEditBackdrop}>
        <View style={[styles.customerEditSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.customerEditHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.customerEditTitleRow}>
              <Feather name="edit-2" size={18} color="#2563eb" />
              <Text style={[styles.customerEditTitle, { color: colors.text }]}>
                Edit Customer
              </Text>
            </View>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.cardMuted }]}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.customerEditScroll}
            contentContainerStyle={styles.customerEditForm}
            keyboardShouldPersistTaps="handled"
          >
            <EditField
              label="User ID"
              value={String(form.publicId || "")}
              editable={false}
              colors={colors}
            />
            <EditField
              label="Full Name *"
              value={form.name || ""}
              onChangeText={(value) => set("name", value)}
              colors={colors}
            />
            <EditField
              label="Phone Number"
              value={form.phoneNumber || ""}
              onChangeText={(value) => set("phoneNumber", value)}
              keyboardType="phone-pad"
              colors={colors}
            />
            <EditField
              label="Email Address *"
              value={form.email || ""}
              onChangeText={(value) => set("email", value)}
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />
            <EditSelect
              label="Status"
              value={form.status}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={(value) => set("status", value)}
              colors={colors}
            />
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>
                RESET PASSWORD (OPTIONAL)
              </Text>
              <View
                style={[
                  styles.editPassword,
                  { backgroundColor: colors.cardMuted, borderColor: colors.border },
                ]}
              >
                <TextInput
                  value={form.password || ""}
                  onChangeText={(value) => set("password", value)}
                  secureTextEntry={!showPassword}
                  placeholder="Leave blank to keep current"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.editPasswordInput, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.editPasswordEye}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={19}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              <Text style={[styles.editHelp, { color: colors.textMuted }]}>
                Min. 6 characters. The customer must use the new password at
                their next login.
              </Text>
            </View>
            <View style={[styles.editAddress, { borderTopColor: colors.border }]}>
              <Text style={styles.editAddressTitle}>Address Details</Text>
              <View style={styles.editTwoColumns}>
                <View style={styles.editHalf}>
                  <EditSelect
                    label="Province"
                    value={form.province}
                    options={
                      provinceOptions.length
                        ? provinceOptions
                        : [form.province || "Romblon"]
                    }
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        province: value,
                        city: "",
                      }))
                    }
                    colors={colors}
                  />
                </View>
                <View style={styles.editHalf}>
                  <EditSelect
                    label="City / Municipality"
                    value={form.city}
                    options={
                      cityOptions.length
                        ? cityOptions
                        : [form.city].filter(Boolean)
                    }
                    onChange={(value) => set("city", value)}
                    colors={colors}
                  />
                </View>
              </View>
              <View style={styles.editTwoColumns}>
                <View style={styles.editHalf}>
                  <EditField
                    label="Barangay"
                    value={form.barangay || ""}
                    onChangeText={(value) => set("barangay", value)}
                    colors={colors}
                  />
                </View>
                <View style={styles.editHalf}>
                  <EditField
                    label="Street Name"
                    value={form.street || ""}
                    onChangeText={(value) => set("street", value)}
                    colors={colors}
                  />
                </View>
              </View>
              <EditField
                label="Unit / House / Block"
                value={form.unit || ""}
                onChangeText={(value) => set("unit", value)}
                colors={colors}
              />
            </View>
          </ScrollView>
          <View style={[styles.customerEditActions, { borderTopColor: colors.border }]}>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.editButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.editCancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={save}
              style={[styles.editButton, styles.editSave, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#fff" />
                  <Text style={styles.editSaveText}>Save Customer</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditField({ label, colors, editable = true, ...props }) {
  return (
    <View style={styles.editField}>
      <Text style={[styles.editLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        {...props}
        editable={editable}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.editInput,
          {
            color: colors.text,
            backgroundColor: editable ? colors.surface : colors.cardMuted,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

function EditSelect({ label, value, options, onChange, colors }) {
  const [open, setOpen] = useState(false);
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const selected =
    normalized.find((option) => option.value === value)?.label || value;
  return (
    <View style={styles.editField}>
      <Text style={[styles.editLabel, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.editSelect,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.editSelectText, { color: colors.text }]}>
          {selected || "Select..."}
        </Text>
        <Feather name="chevron-down" size={17} color={colors.textMuted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.editSelectBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.editSelectSheet, { backgroundColor: colors.surface }]}
          >
            <View style={styles.editSelectHeader}>
              <Text style={[styles.customerEditTitle, { color: colors.text }]}>
                {label}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                style={[styles.close, { backgroundColor: colors.cardMuted }]}
              >
                <Feather name="x" size={19} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.editSelectOptions}>
              {normalized.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.editSelectOption,
                    {
                      borderColor:
                        value === option.value ? "#93c5fd" : colors.border,
                      backgroundColor:
                        value === option.value ? "#eff6ff" : colors.cardMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.editSelectOptionText,
                      { color: value === option.value ? "#2563eb" : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {value === option.value ? (
                    <Feather name="check" size={16} color="#2563eb" />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionSection({ title, values, current, onPress }) {
  return (
    <View style={styles.actionSection}>
      <Text style={styles.actionTitle}>{title}</Text>
      <View style={styles.wrap}>
        {values.filter((value) => value !== current).map((value) => (
          <Pressable key={value} style={styles.actionChip} onPress={() => onPress(value)}>
            <Text style={styles.actionChipText}>{value.replace(/_/g, " ")}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReportView({ config, data, colors, refreshing, reload }) {
  const reports = data?.reports || {};
  const cards = [
    ["Total Shipments", reports.totalShipments, "package"],
    ["Delivered", reports.delivered, "check-circle"],
    ["Failed Deliveries", reports.failedDeliveries, "alert-triangle"],
    ["Returns", reports.returns, "corner-up-left"],
    ["Trips", reports.totalTrips, "truck"],
    ["Drivers", reports.staffByRole?.driver || 0, "users"],
    ["Checkers", reports.staffByRole?.checker || 0, "user-check"],
  ];
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader back title={config.title} subtitle={config.subtitle} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload({ refresh: true })} />}
        contentContainerStyle={styles.reportContent}
      >
        <View style={styles.reportGrid}>
          {cards.map(([label, value, icon]) => (
            <ManagerCard key={label} style={styles.reportCard}>
              <Feather name={icon} size={20} color="#4f46e5" />
              <Text style={[styles.reportValue, { color: colors.text }]}>{value || 0}</Text>
              <Text style={[styles.reportLabel, { color: colors.textMuted }]}>{label}</Text>
            </ManagerCard>
          ))}
        </View>
        <ManagerCard>
          <SectionTitle title="Shipment status breakdown" subtitle="Live authorized data" />
          {Object.entries(reports.shipmentStatuses || {}).map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailValue, { color: colors.text }]}>{label.replace(/_/g, " ")}</Text>
              <Text style={styles.reportCount}>{value}</Text>
            </View>
          ))}
        </ManagerCard>
      </ScrollView>
    </View>
  );
}

function SettingsView({
  config,
  data,
  colors,
  pushAlerts,
  setPushAlerts,
  reload,
}) {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "administrator";
  const settings = data?.settings || {};
  const [truckTypesText, setTruckTypesText] = useState("");
  const [warehousesText, setWarehousesText] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    setTruckTypesText((settings.truckTypes || []).join("\n"));
    setWarehousesText(
      (settings.warehouses || [])
        .map((warehouse) =>
          typeof warehouse === "string"
            ? warehouse
            : [
                warehouse.code,
                warehouse.name,
                warehouse.city,
                warehouse.province,
              ]
                .filter(Boolean)
                .join(" | "),
        )
        .join("\n"),
    );
  }, [settings.truckTypes, settings.warehouses]);

  if (isAdmin) {
    return (
      <AdminMobileSettingsEditor
        settings={settings}
        reload={reload}
      />
    );
  }

  const saveSettings = async () => {
    if (savingSettings) return;
    try {
      setSavingSettings(true);
      setSaveMessage("");
      const payload = { pushNotifications: pushAlerts };
      if (isAdmin) {
        const truckTypes = truckTypesText
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean);
        const warehouses = warehousesText
          .split(/\r?\n/)
          .map((line) => {
            const [code, name, city, province] = line
              .split("|")
              .map((value) => value.trim());
            return { code, name, city, province };
          })
          .filter((warehouse) => warehouse.code && warehouse.name);
        if (!truckTypes.length || !warehouses.length) {
          throw new Error(
            "Add at least one truck type and one warehouse using CODE | Name.",
          );
        }
        payload.operationalSettings = { truckTypes, warehouses };
      }
      await updateManagerMobileSettings(payload);
      setSaveMessage("Settings saved successfully.");
      await reload({ refresh: true });
    } catch (nextError) {
      Alert.alert(
        "Settings not saved",
        nextError.message || "Please try again.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader back title={config.title} subtitle={config.subtitle} />
      <ScrollView contentContainerStyle={styles.reportContent}>
        <ManagerCard>
          <SectionTitle title="Notifications" subtitle="Manager operational alerts" />
          <View style={styles.settingRow}>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Push notifications</Text>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                Trips, shipments, messages, calls, and assignment updates
              </Text>
            </View>
            <Switch value={pushAlerts} onValueChange={setPushAlerts} trackColor={{ true: "#818cf8" }} />
          </View>
        </ManagerCard>
        {isAdmin ? (
          <ManagerCard>
            <SectionTitle
              title="Operational settings"
              subtitle="These values are shared with the web application"
            />
            <Text style={[styles.settingsFieldLabel, { color: colors.text }]}>
              Truck types
            </Text>
            <TextInput
              multiline
              value={truckTypesText}
              onChangeText={setTruckTypesText}
              placeholder="One truck type per line"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.settingsInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.cardMuted,
                },
              ]}
            />
            <Text style={[styles.settingsFieldLabel, { color: colors.text }]}>
              Warehouses
            </Text>
            <Text style={[styles.settingsHint, { color: colors.textMuted }]}>
              Enter one per line: CODE | Name | City | Province
            </Text>
            <TextInput
              multiline
              value={warehousesText}
              onChangeText={setWarehousesText}
              placeholder="DIV | Divisoria | Manila | Metro Manila"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.settingsInput,
                styles.warehouseInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.cardMuted,
                },
              ]}
            />
          </ManagerCard>
        ) : (
          <ManagerCard>
            <SectionTitle
              title="Operational reference"
              subtitle="Global settings can only be changed by an Admin"
            />
            <InfoLine label="Truck types" value={(settings.truckTypes || []).join(", ") || "Default types"} colors={colors} />
            <InfoLine label="Warehouses" value={(settings.warehouses || []).map((value) => value.name || value.code || value).join(", ") || (data?.scope?.warehouses || []).join(", ")} colors={colors} />
          </ManagerCard>
        )}
        <Pressable
          disabled={savingSettings}
          onPress={saveSettings}
          style={[styles.primary, savingSettings && styles.disabled]}
        >
          {savingSettings ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Save Settings</Text>
          )}
        </Pressable>
        {saveMessage ? (
          <Text style={[styles.settingsSuccess, { color: colors.success }]}>
            {saveMessage}
          </Text>
        ) : null}
        <ManagerCard>
          <SectionTitle title="Assignment scope" subtitle="Access applied to this account" />
          <InfoLine label="Your municipalities" value={(data?.scope?.municipalities || []).join(", ") || "Warehouse-wide"} colors={colors} />
        </ManagerCard>
        <Text style={[styles.settingsNote, { color: colors.textMuted }]}>
          Theme, password, and account controls remain available in Profile.
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoLine({ label, value, colors }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value || "Not available"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  moduleList: { flex: 1 },
  toolbar: { padding: 14, gap: 10 },
  scrollingToolbarHeader: { marginHorizontal: -14, marginTop: -14 },
  invoiceOverview: { gap: 13, marginBottom: 2 },
  invoiceStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  invoiceStatCard: {
    width: "48.6%",
    minHeight: 82,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoiceStatLabel: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  invoiceStatValue: { marginTop: 7, fontSize: 21, fontWeight: "900" },
  invoiceStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceTools: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoiceToolsTitle: { flex: 1, fontSize: 15, fontWeight: "900" },
  invoiceExportButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  invoiceExportText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  invoiceRefreshButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  search: { minHeight: 46, borderRadius: 13, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  chips: { flexDirection: "row", gap: 7 },
  chip: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 10, fontWeight: "800" },
  list: { padding: 14, paddingBottom: 34, gap: 10 },
  emptyList: { flexGrow: 1 },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  userMenuBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.58)",
  },
  userMenuSheet: {
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 11,
  },
  userMenuHeader: {
    marginBottom: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userMenuTitle: { fontSize: 18, fontWeight: "900" },
  userMenuMeta: { marginTop: 3, fontSize: 10, fontWeight: "700" },
  userMenuAction: {
    minHeight: 76,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  userMenuIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  userMenuActionTitle: { fontSize: 12, fontWeight: "900" },
  userMenuActionMeta: { marginTop: 3, fontSize: 9, lineHeight: 13 },
  cardTitle: { fontSize: 14, fontWeight: "900" },
  cardMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  assignment: { fontSize: 11, marginTop: 10 },
  openRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 12 },
  openText: { color: "#4f46e5", fontSize: 11, fontWeight: "800" },
  userCardActions: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userRoleSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userRoleText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  userIconButton: {
    width: 39,
    height: 39,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  userEditIcon: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  userDeleteIcon: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 28 },
  sheetTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "900" },
  sheetSubtitle: { fontSize: 11, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sheetScroll: { marginTop: 14 },
  customerTabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  customerTab: {
    flex: 1,
    minWidth: 0,
    minHeight: 49,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  customerTabActive: {
    borderBottomColor: "#10b981",
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  customerTabText: { flexShrink: 1, fontSize: 9, fontWeight: "900" },
  customerDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  customerDetailCard: {
    width: "48.4%",
    minHeight: 96,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    gap: 11,
  },
  customerAddressCard: {
    minHeight: 88,
    marginTop: 10,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    gap: 11,
  },
  customerDetailValueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  customerDetailValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  customerEmptyText: {
    paddingVertical: 28,
    textAlign: "center",
    fontSize: 11,
  },
  detailRow: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  detailValue: { fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 3 },
  actionSection: { paddingVertical: 18 },
  relatedRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  actionTitle: { fontSize: 14, fontWeight: "900", marginBottom: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: { minHeight: 38, borderRadius: 11, borderWidth: 1, borderColor: "#818cf8", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  actionChipActive: { backgroundColor: "#4f46e5" },
  actionChipText: { color: "#4f46e5", fontSize: 11, fontWeight: "800" },
  editCustomerButton: {
    minHeight: 46,
    marginBottom: 16,
    borderRadius: 13,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  editCustomerButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  adminUserActions: { flexDirection: "row", gap: 10 },
  adminUserButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  adminUserEdit: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  adminUserDelete: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  adminUserRestore: { borderColor: "#a7f3d0", backgroundColor: "#ecfdf5" },
  adminUserEditText: { color: "#2563eb", fontSize: 11, fontWeight: "900" },
  adminUserDeleteText: { color: "#ef4444", fontSize: 11, fontWeight: "900" },
  adminUserRestoreText: { color: "#059669", fontSize: 11, fontWeight: "900" },
  customerEditBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.58)",
  },
  customerEditSheet: {
    maxHeight: "94%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },
  customerEditHeader: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  customerEditTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  customerEditTitle: { fontSize: 18, fontWeight: "900" },
  customerEditScroll: { flexGrow: 0 },
  customerEditForm: { padding: 18, gap: 12 },
  editField: { gap: 6 },
  editLabel: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.45,
  },
  editInput: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 14,
  },
  editPassword: {
    minHeight: 49,
    paddingLeft: 13,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  editPasswordInput: { flex: 1, minWidth: 0, padding: 0, fontSize: 14 },
  editPasswordEye: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  editHelp: { fontSize: 9, lineHeight: 14 },
  editAddress: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 11,
  },
  editAddressTitle: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  editTwoColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  editHalf: { flex: 1, minWidth: 0 },
  customerEditActions: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
  },
  editButton: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  editSave: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  editCancelText: { fontSize: 12, fontWeight: "900" },
  editSaveText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  editSelect: {
    minHeight: 49,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editSelectText: { flex: 1, fontSize: 14, fontWeight: "600" },
  editSelectBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.58)",
  },
  editSelectSheet: {
    maxHeight: "72%",
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  editSelectHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  editSelectOptions: { gap: 7 },
  editSelectOption: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  editSelectOptionText: { fontSize: 12, fontWeight: "700" },
  primary: { minHeight: 48, marginTop: 15, borderRadius: 13, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.55 },
  reportContent: { padding: 15, paddingBottom: 36, gap: 13 },
  reportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportCard: { width: "48.5%", minHeight: 120 },
  reportValue: { fontSize: 25, fontWeight: "900", marginTop: 12 },
  reportLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  reportCount: { marginLeft: "auto", color: "#4f46e5", fontWeight: "900" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  settingsNote: { fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  settingsFieldLabel: { fontSize: 12, fontWeight: "800", marginTop: 16 },
  settingsHint: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  settingsInput: {
    minHeight: 92,
    marginTop: 7,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  warehouseInput: { minHeight: 120 },
  settingsSuccess: { fontSize: 12, fontWeight: "800", textAlign: "center" },
});
