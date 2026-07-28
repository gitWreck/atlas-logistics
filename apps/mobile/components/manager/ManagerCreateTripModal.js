import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../contexts/ThemeContext";
import { createTruckTrip } from "../utilities/FirebaseFunctions";
import { displayName } from "./ManagerUI";

const TRIP_TYPES = [
  ["HUB_TRANSFER", "Transfer"],
  ["LOCAL_PICKUP", "Pickup"],
  ["DELIVERY", "Delivery"],
];

function dateInput(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function optionKey(value) {
  return String(value || "").trim().toLowerCase();
}

function warehouseOption(value, index) {
  if (typeof value === "string") {
    return { id: value, name: value, code: value };
  }
  const name =
    value?.name || value?.warehouseName || value?.label || value?.code || "";
  const code = value?.code || value?.warehouseCode || name;
  return { ...value, id: value?.id || code || `warehouse-${index}`, name, code };
}

function truckPlate(truck = {}) {
  return (
    truck.plateNumber ||
    truck.truckPlateNumber ||
    truck.vehiclePlate ||
    truck.registrationNumber ||
    ""
  );
}

export default function ManagerCreateTripModal({
  visible,
  scope,
  staff,
  trucks,
  settings,
  onClose,
  onCreated,
}) {
  const { colors } = useTheme();
  const drivers = useMemo(
    () => (staff || []).filter((member) => String(member.role).toLowerCase() === "driver"),
    [staff],
  );
  const warehouses = useMemo(() => {
    const configured = (settings?.warehouses || [])
      .map(warehouseOption)
      .filter((warehouse) => warehouse.name);
    const assigned = (scope?.warehouses || [])
      .map(warehouseOption)
      .filter((warehouse) => warehouse.name);
    if (!assigned.length) return configured;
    const allowed = new Set(
      assigned.flatMap((warehouse) => [
        optionKey(warehouse.name),
        optionKey(warehouse.code),
      ]),
    );
    const matched = configured.filter(
      (warehouse) =>
        allowed.has(optionKey(warehouse.name)) ||
        allowed.has(optionKey(warehouse.code)),
    );
    return matched.length ? matched : assigned;
  }, [scope?.warehouses, settings?.warehouses]);
  const truckOptions = useMemo(
    () => (trucks || []).filter((truck) => truckPlate(truck)),
    [trucks],
  );
  const [form, setForm] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initialWarehouse = warehouses[0] || null;
    setForm({
      tripType: "HUB_TRANSFER",
      origin: initialWarehouse?.name || "",
      originCode: initialWarehouse?.code || "",
      destination: "",
      destinationCode: "",
      plannedDeparture: dateInput(1),
      estimatedArrival: dateInput(9),
      driverId: "",
      driverName: "",
      truckId: "",
      truckPlateNumber: "",
      helperName: "",
    });
    setOpenDropdown(null);
  }, [visible, warehouses]);

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const selectTripType = (tripType) => {
    const initialWarehouse = warehouses[0] || null;
    setForm((current) => ({
      ...current,
      tripType,
      origin:
        tripType === "HUB_TRANSFER" ? initialWarehouse?.name || "" : "",
      originCode:
        tripType === "HUB_TRANSFER" ? initialWarehouse?.code || "" : "",
      destination: "",
      destinationCode: "",
    }));
    setOpenDropdown(null);
  };

  const selectDriver = (driver) =>
    setForm((current) => ({
      ...current,
      driverId: driver.id,
      driverName: displayName(driver),
    }));

  const selectWarehouse = (field, warehouse) => {
    setForm((current) => ({
      ...current,
      [field]: warehouse.name,
      [`${field}Code`]: warehouse.code,
      ...(field === "origin" &&
      optionKey(current.destinationCode || current.destination) ===
        optionKey(warehouse.code || warehouse.name)
        ? { destination: "", destinationCode: "" }
        : {}),
    }));
    setOpenDropdown(null);
  };

  const selectTruck = (truck) => {
    setForm((current) => ({
      ...current,
      truckId: truck.id || null,
      truckPlateNumber: truckPlate(truck),
    }));
    setOpenDropdown(null);
  };

  const save = async () => {
    if (
      !form.plannedDeparture ||
      !form.estimatedArrival ||
      !form.truckPlateNumber?.trim() ||
      (form.tripType === "HUB_TRANSFER" &&
        (!form.origin?.trim() || !form.destination?.trim()))
    ) {
      Alert.alert("Missing information", "Complete the required trip fields.");
      return;
    }
    try {
      setSaving(true);
      const response = await createTruckTrip({
        tripType: form.tripType,
        origin: form.origin?.trim() || null,
        originCode: form.originCode?.trim() || form.origin?.trim() || null,
        destination: form.destination?.trim() || null,
        destinationCode:
          form.destinationCode?.trim() || form.destination?.trim() || null,
        plannedDeparture: new Date(form.plannedDeparture).toISOString(),
        estimatedArrival: new Date(form.estimatedArrival).toISOString(),
        driverId: form.driverId || null,
        driverName: form.driverName || null,
        truckId: form.truckId || null,
        truckPlateNumber: form.truckPlateNumber.trim().toUpperCase(),
        helperName: form.helperName?.trim() || null,
      });
      Alert.alert(
        "Trip created",
        response?.data?.tripId || "The trip was created successfully.",
      );
      onClose();
      await onCreated?.();
    } catch (error) {
      Alert.alert("Trip not created", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Create trip</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Uses the same Manager trip workflow as web
              </Text>
            </View>
            <Pressable disabled={saving} onPress={onClose} style={[styles.close, { backgroundColor: colors.cardMuted }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.textMuted }]}>TRIP TYPE</Text>
            <View style={styles.types}>
              {TRIP_TYPES.map(([value, label]) => {
                const selected = form.tripType === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => selectTripType(value)}
                    style={[
                      styles.type,
                      {
                        backgroundColor: selected ? "#0f766e" : colors.cardMuted,
                        borderColor: selected ? "#0f766e" : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? "#fff" : colors.text, fontWeight: "800", fontSize: 11 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {form.tripType === "HUB_TRANSFER" ? (
              <>
                <DropdownField
                  label="Origin warehouse *"
                  value={form.origin}
                  placeholder="Select origin warehouse"
                  options={warehouses}
                  open={openDropdown === "origin"}
                  onToggle={() =>
                    setOpenDropdown((current) =>
                      current === "origin" ? null : "origin",
                    )
                  }
                  onSelect={(warehouse) =>
                    selectWarehouse("origin", warehouse)
                  }
                  getKey={(warehouse) => warehouse.id || warehouse.code}
                  getLabel={(warehouse) => warehouse.name}
                  getMeta={(warehouse) => warehouse.code}
                  colors={colors}
                />
                <DropdownField
                  label="Destination *"
                  value={form.destination}
                  placeholder="Select destination"
                  options={warehouses.filter(
                    (warehouse) =>
                      optionKey(warehouse.code || warehouse.name) !==
                      optionKey(form.originCode || form.origin),
                  )}
                  open={openDropdown === "destination"}
                  onToggle={() =>
                    setOpenDropdown((current) =>
                      current === "destination" ? null : "destination",
                    )
                  }
                  onSelect={(warehouse) =>
                    selectWarehouse("destination", warehouse)
                  }
                  getKey={(warehouse) => warehouse.id || warehouse.code}
                  getLabel={(warehouse) => warehouse.name}
                  getMeta={(warehouse) => warehouse.code}
                  colors={colors}
                />
              </>
            ) : null}
            <Field label="Departure (YYYY-MM-DDTHH:mm) *" value={form.plannedDeparture || ""} onChangeText={(value) => setField("plannedDeparture", value)} colors={colors} />
            <Field label="Estimated arrival (YYYY-MM-DDTHH:mm) *" value={form.estimatedArrival || ""} onChangeText={(value) => setField("estimatedArrival", value)} colors={colors} />
            <DropdownField
              label="Driver name"
              value={form.driverName}
              placeholder="Select authorized driver (optional)"
              options={drivers}
              open={openDropdown === "driver"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "driver" ? null : "driver",
                )
              }
              onSelect={(driver) => {
                selectDriver(driver);
                setOpenDropdown(null);
              }}
              getKey={(driver) => driver.id}
              getLabel={displayName}
              getMeta={(driver) =>
                driver.assignedMunicipality ||
                driver.warehouseName ||
                driver.status
              }
              colors={colors}
            />
            <DropdownField
              label="Truck plate # *"
              value={form.truckPlateNumber}
              placeholder="Select authorized truck"
              options={truckOptions}
              open={openDropdown === "truck"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "truck" ? null : "truck",
                )
              }
              onSelect={selectTruck}
              getKey={(truck) => truck.id || truckPlate(truck)}
              getLabel={truckPlate}
              getMeta={(truck) =>
                truck.truckType ||
                truck.vehicleType ||
                truck.model ||
                truck.status
              }
              colors={colors}
            />
            <Field
              label="Truck helper (optional)"
              value={form.helperName || ""}
              onChangeText={(value) => setField("helperName", value)}
              placeholder="Optional name"
              colors={colors}
            />
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.button, { borderColor: colors.border }]}>
              <Text style={[styles.cancel, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={save} style={[styles.button, styles.primary]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create trip</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DropdownField({
  label,
  value,
  placeholder,
  options,
  open,
  onToggle,
  onSelect,
  getKey,
  getLabel,
  getMeta,
  colors,
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={[
          styles.dropdownControl,
          {
            borderColor: open ? "#0f766e" : colors.border,
            backgroundColor: colors.cardMuted,
          },
        ]}
      >
        <Text
          style={[
            styles.dropdownValue,
            { color: value ? colors.text : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.dropdownMenu,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          {options.length ? (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={styles.dropdownScroll}
            >
              {options.map((option, index) => {
                const optionLabel = getLabel(option);
                const meta = getMeta?.(option);
                const selected = optionKey(optionLabel) === optionKey(value);
                return (
                  <Pressable
                    key={String(getKey(option) || index)}
                    onPress={() => onSelect(option)}
                    style={[
                      styles.dropdownOption,
                      index > 0 && { borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.dropdownOptionCopy}>
                      <Text
                        style={[
                          styles.dropdownOptionLabel,
                          { color: colors.text },
                        ]}
                      >
                        {optionLabel}
                      </Text>
                      {meta ? (
                        <Text
                          style={[
                            styles.dropdownOptionMeta,
                            { color: colors.textMuted },
                          ]}
                        >
                          {meta}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Feather name="check" size={17} color="#0f766e" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={[styles.dropdownEmpty, { color: colors.textMuted }]}>
              No authorized options available.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, colors, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.58)" },
  sheet: { maxHeight: "94%", borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: 18, gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { fontSize: 12, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  form: { paddingHorizontal: 18, paddingBottom: 20, gap: 12 },
  label: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  types: { flexDirection: "row", gap: 8 },
  type: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  field: { gap: 5 },
  input: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 14 },
  dropdownControl: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  dropdownValue: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700" },
  dropdownMenu: { maxHeight: 190, borderWidth: 1, borderRadius: 13, overflow: "hidden" },
  dropdownScroll: { maxHeight: 188 },
  dropdownOption: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: StyleSheet.hairlineWidth },
  dropdownOptionCopy: { flex: 1, minWidth: 0 },
  dropdownOptionLabel: { fontSize: 12, fontWeight: "800" },
  dropdownOptionMeta: { marginTop: 2, fontSize: 9, textTransform: "uppercase" },
  dropdownEmpty: { padding: 14, fontSize: 11, textAlign: "center" },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, padding: 16 },
  button: { flex: 1, minHeight: 49, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  cancel: { fontWeight: "800" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
