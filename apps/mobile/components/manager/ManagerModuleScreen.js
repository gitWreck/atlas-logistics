import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState(null);
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
    const values = data[config.source] || [];
    if (config.roleFilter) {
      return values.filter(
        (row) =>
          String(row.role || "").toLowerCase() === config.roleFilter,
      );
    }
    return values;
  }, [config.roleFilter, config.source, data]);

  const statuses = useMemo(
    () => [
      "ALL",
      ...new Set(
        sourceRows
          .map((row) => String(row.status || row.employmentStatus || "").toUpperCase())
          .filter(Boolean),
      ),
    ].slice(0, 7),
    [sourceRows],
  );
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceRows.filter((row) => {
      const rowStatus = String(row.status || row.employmentStatus || "").toUpperCase();
      return (
        (status === "ALL" || rowStatus === status) &&
        (!term || searchable(row).includes(term))
      );
    });
  }, [search, sourceRows, status]);
  const resourceType = config.resourceType || config.source;

  if (loading) return <LoadingState label={`Loading ${config.title.toLowerCase()}…`} />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const perform = async (label, callback) => {
    try {
      setSaving(true);
      await callback();
      setSelected(null);
      await reload({ refresh: true });
    } catch (nextError) {
      Alert.alert(`${label} failed`, nextError.message || "Please try again.");
    } finally {
      setSaving(false);
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
        title={config.title}
        subtitle={config.subtitle}
        actionIcon={["trucks", "customers", "invoices"].includes(config.source) ? "plus" : undefined}
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
            <View style={[styles.search, { backgroundColor: colors.cardMuted }]}>
              <Feather name="search" size={17} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${config.title.toLowerCase()}`}
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
              } else {
                setSelected(item);
              }
            }}
          >
            <ResourceCard type={resourceType} item={item} colors={colors} />
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
      />
      <ManagerQuickCreateModal
        type={config.source}
        visible={createVisible}
        scope={data?.scope}
        onClose={() => setCreateVisible(false)}
        onCreated={() => reload({ refresh: true })}
      />
    </View>
  );
}

function ResourceCard({ type, item, colors }) {
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
        <StatusBadge status={status} />
      </View>
      {item.currentTripId || item.assignedTripId ? (
        <Text style={[styles.assignment, { color: colors.textMuted }]}>
          Current trip: {item.currentTripId || item.assignedTripId}
        </Text>
      ) : null}
      <View style={styles.openRow}>
        <Text style={styles.openText}>View details and actions</Text>
        <Feather name="chevron-right" size={17} color="#4f46e5" />
      </View>
    </ManagerCard>
  );
}

function DetailSheet({
  type,
  item,
  data,
  colors,
  saving,
  onClose,
  onTruckStatus,
  onInvoiceStatus,
  onMunicipalities,
}) {
  const [municipalities, setMunicipalities] = useState([]);
  React.useEffect(() => setMunicipalities(municipalityList(item || {})), [item]);
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
                Authorized Manager record
              </Text>
            </View>
            <Pressable onPress={onClose} style={[styles.close, { backgroundColor: colors.cardMuted }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetScroll}>
            {fields.map(([field, value]) => (
              <View key={field} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {field.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{String(value)}</Text>
              </View>
            ))}
            {type === "customers" ? (
              <View style={styles.actionSection}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Shipment history ({relatedShipments.length})
                </Text>
                {relatedShipments.slice(0, 10).map((shipment) => (
                  <View key={shipment.id} style={[styles.relatedRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.cardCopy}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>
                        {shipment.trackingNumber || shipment.shipmentId || shipment.id}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                        {formatDate(shipment.updatedAt)}
                      </Text>
                    </View>
                    <StatusBadge status={shipment.status} />
                  </View>
                ))}
                <Text style={[styles.actionTitle, { color: colors.text, marginTop: 18 }]}>
                  Pickup requests ({relatedPickups.length})
                </Text>
                {relatedPickups.slice(0, 10).map((pickup) => (
                  <View key={pickup.id} style={[styles.relatedRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {pickup.trackingNumber || pickup.shipmentId || pickup.id}
                    </Text>
                    <StatusBadge status={pickup.status} />
                  </View>
                ))}
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
        </View>
      </View>
    </Modal>
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
  cardTitle: { fontSize: 14, fontWeight: "900" },
  cardMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  assignment: { fontSize: 11, marginTop: 10 },
  openRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 12 },
  openText: { color: "#4f46e5", fontSize: 11, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 28 },
  sheetTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "900" },
  sheetSubtitle: { fontSize: 11, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sheetScroll: { marginTop: 14 },
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
