import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../contexts/ThemeContext";
import { updateManagerMobileSettings } from "../utilities/FirebaseFunctions";
import { ManagerCard, ManagerHeader } from "./ManagerUI";

const EMPTY_WAREHOUSE = { name: "", code: "", city: "", province: "" };
const EMPTY_CITY = { name: "", code: "" };

function normalizeSettings(settings = {}) {
  return {
    truckTypes: Array.isArray(settings.truckTypes)
      ? settings.truckTypes.map(String)
      : [],
    warehouses: Array.isArray(settings.warehouses)
      ? settings.warehouses.map((warehouse) =>
          typeof warehouse === "string"
            ? { ...EMPTY_WAREHOUSE, name: warehouse, code: warehouse }
            : { ...EMPTY_WAREHOUSE, ...warehouse },
        )
      : [],
    phLocations:
      settings.phLocations &&
      typeof settings.phLocations === "object" &&
      !Array.isArray(settings.phLocations)
        ? Object.fromEntries(
            Object.entries(settings.phLocations).map(([province, cities]) => [
              province,
              (Array.isArray(cities) ? cities : []).map((city) => ({
                ...EMPTY_CITY,
                ...city,
              })),
            ]),
          )
        : {},
  };
}

function confirmRemove(title, message, onConfirm) {
  Alert.alert(title, `${message}\n\nThis change is not applied until Save Settings is pressed.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: onConfirm },
  ]);
}

export default function AdminMobileSettingsEditor({ settings, reload }) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState("truckTypes");
  const [draft, setDraft] = useState(() => normalizeSettings(settings));
  const [newProvince, setNewProvince] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft(normalizeSettings(settings));
  }, [settings]);

  const provinces = useMemo(
    () => Object.keys(draft.phLocations || {}).sort(),
    [draft.phLocations],
  );

  const updateTruckType = (index, value) =>
    setDraft((current) => ({
      ...current,
      truckTypes: current.truckTypes.map((type, itemIndex) =>
        itemIndex === index ? value : type,
      ),
    }));

  const updateWarehouse = (index, field, value) =>
    setDraft((current) => ({
      ...current,
      warehouses: current.warehouses.map((warehouse, itemIndex) =>
        itemIndex === index ? { ...warehouse, [field]: value } : warehouse,
      ),
    }));

  const updateCity = (province, index, field, value) =>
    setDraft((current) => ({
      ...current,
      phLocations: {
        ...current.phLocations,
        [province]: current.phLocations[province].map((city, itemIndex) =>
          itemIndex === index ? { ...city, [field]: value } : city,
        ),
      },
    }));

  const addProvince = () => {
    const province = newProvince.trim();
    if (!province) return;
    setDraft((current) => ({
      ...current,
      phLocations: current.phLocations[province]
        ? current.phLocations
        : { ...current.phLocations, [province]: [{ ...EMPTY_CITY }] },
    }));
    setNewProvince("");
  };

  const saveSettings = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setMessage("");
      const operationalSettings = {
        truckTypes: draft.truckTypes
          .map((value) => value.trim())
          .filter(Boolean),
        warehouses: draft.warehouses
          .map((warehouse) => ({
            name: String(warehouse.name || "").trim(),
            code: String(warehouse.code || "").trim().toUpperCase(),
            city: String(warehouse.city || "").trim(),
            province: String(warehouse.province || "").trim(),
          }))
          .filter((warehouse) => warehouse.name && warehouse.code),
        phLocations: Object.fromEntries(
          Object.entries(draft.phLocations)
            .map(([province, cities]) => [
              province.trim(),
              cities
                .map((city) => ({
                  name: String(city.name || "").trim(),
                  code: String(city.code || "").trim().toUpperCase(),
                }))
                .filter((city) => city.name && city.code),
            ])
            .filter(([province, cities]) => province && cities.length),
        ),
      };
      if (
        !operationalSettings.truckTypes.length ||
        !operationalSettings.warehouses.length ||
        !Object.keys(operationalSettings.phLocations).length
      ) {
        throw new Error(
          "Truck Types, Warehouses, and Locations must each contain at least one complete entry.",
        );
      }
      await updateManagerMobileSettings({ operationalSettings });
      setMessage("Settings saved. Web and mobile forms now use these values.");
      await reload({ refresh: true });
    } catch (error) {
      Alert.alert("Settings not saved", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title="App Settings"
        subtitle="Live values shared by web and mobile forms"
      />
      <ScrollView
        style={styles.settingsScroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View
        style={[
          styles.saveBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.saveCopy, { color: colors.textMuted }]}>
          Changes remain drafts until saved.
        </Text>
        <Pressable
          disabled={saving}
          onPress={saveSettings}
          style={[styles.saveButton, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </Pressable>
      </View>
      {message ? (
        <View style={[styles.message, { backgroundColor: colors.successSoft }]}>
          <Feather name="check-circle" size={17} color={colors.success} />
          <Text style={[styles.messageText, { color: colors.success }]}>
            {message}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.tabs,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {[
          ["truckTypes", "truck", "Truck Types"],
          ["warehouses", "home", "Warehouses"],
          ["locations", "map-pin", "Locations"],
        ].map(([value, icon, label]) => {
          const active = activeTab === value;
          return (
            <Pressable
              key={value}
              onPress={() => setActiveTab(value)}
              style={[
                styles.tab,
                active && { borderBottomColor: colors.primary },
              ]}
            >
              <Feather
                name={icon}
                size={16}
                color={active ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.content}>
        {activeTab === "truckTypes" ? (
          <>
            {draft.truckTypes.map((type, index) => (
              <ManagerCard key={`truck-type-${index}`} style={styles.rowCard}>
                <TextInput
                  value={type}
                  onChangeText={(value) => updateTruckType(index, value)}
                  placeholder="Truck type"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    styles.flexInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.cardMuted,
                    },
                  ]}
                />
                <RemoveButton
                  label="Remove truck type"
                  onPress={() =>
                    confirmRemove(
                      "Remove truck type?",
                      type || "Remove this empty row?",
                      () =>
                        setDraft((current) => ({
                          ...current,
                          truckTypes: current.truckTypes.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })),
                    )
                  }
                />
              </ManagerCard>
            ))}
            <AddButton
              label="Add Truck Type"
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  truckTypes: [...current.truckTypes, ""],
                }))
              }
            />
          </>
        ) : null}

        {activeTab === "warehouses" ? (
          <>
            {draft.warehouses.map((warehouse, index) => (
              <ManagerCard key={`warehouse-${index}`}>
                <View style={styles.cardHeading}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {warehouse.name || warehouse.code || `Warehouse ${index + 1}`}
                  </Text>
                  <RemoveButton
                    label="Remove warehouse"
                    onPress={() =>
                      confirmRemove(
                        "Remove warehouse?",
                        warehouse.name || warehouse.code || "Remove this row?",
                        () =>
                          setDraft((current) => ({
                            ...current,
                            warehouses: current.warehouses.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })),
                      )
                    }
                  />
                </View>
                {[
                  ["name", "Name"],
                  ["code", "Code"],
                  ["city", "City"],
                  ["province", "Province"],
                ].map(([field, label]) => (
                  <TextInput
                    key={field}
                    value={String(warehouse[field] || "")}
                    onChangeText={(value) =>
                      updateWarehouse(index, field, value)
                    }
                    autoCapitalize={field === "code" ? "characters" : "words"}
                    placeholder={label}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.input,
                      styles.stackedInput,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.cardMuted,
                      },
                    ]}
                  />
                ))}
              </ManagerCard>
            ))}
            <AddButton
              label="Add Warehouse"
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  warehouses: [...current.warehouses, { ...EMPTY_WAREHOUSE }],
                }))
              }
            />
          </>
        ) : null}

        {activeTab === "locations" ? (
          <>
            <ManagerCard>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Add Province
              </Text>
              <View style={styles.addProvinceRow}>
                <TextInput
                  value={newProvince}
                  onChangeText={setNewProvince}
                  placeholder="Province name"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    styles.flexInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.cardMuted,
                    },
                  ]}
                />
                <Pressable
                  onPress={addProvince}
                  disabled={!newProvince.trim()}
                  style={[
                    styles.squareAdd,
                    !newProvince.trim() && styles.disabled,
                  ]}
                >
                  <Feather name="plus" size={18} color="#fff" />
                </Pressable>
              </View>
            </ManagerCard>
            {provinces.map((province) => (
              <ManagerCard key={province}>
                <View style={styles.cardHeading}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {province}
                  </Text>
                  <View style={styles.headingActions}>
                    <Pressable
                      accessibilityLabel={`Add city to ${province}`}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          phLocations: {
                            ...current.phLocations,
                            [province]: [
                              ...current.phLocations[province],
                              { ...EMPTY_CITY },
                            ],
                          },
                        }))
                      }
                      style={styles.smallAdd}
                    >
                      <Feather name="plus" size={16} color="#fff" />
                    </Pressable>
                    <RemoveButton
                      label={`Remove ${province}`}
                      onPress={() =>
                        confirmRemove(
                          "Remove province?",
                          `${province} and all of its cities`,
                          () =>
                            setDraft((current) => {
                              const phLocations = { ...current.phLocations };
                              delete phLocations[province];
                              return { ...current, phLocations };
                            }),
                        )
                      }
                    />
                  </View>
                </View>
                {draft.phLocations[province].map((city, index) => (
                  <View key={`${province}-city-${index}`} style={styles.cityRow}>
                    <TextInput
                      value={String(city.name || "")}
                      onChangeText={(value) =>
                        updateCity(province, index, "name", value)
                      }
                      placeholder="City"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        styles.flexInput,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.cardMuted,
                        },
                      ]}
                    />
                    <TextInput
                      value={String(city.code || "")}
                      onChangeText={(value) =>
                        updateCity(province, index, "code", value)
                      }
                      autoCapitalize="characters"
                      placeholder="Code"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        styles.codeInput,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.cardMuted,
                        },
                      ]}
                    />
                    <RemoveButton
                      label="Remove city"
                      onPress={() =>
                        confirmRemove(
                          "Remove city?",
                          city.name || "Remove this empty city?",
                          () =>
                            setDraft((current) => ({
                              ...current,
                              phLocations: {
                                ...current.phLocations,
                                [province]: current.phLocations[province].filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              },
                            })),
                        )
                      }
                    />
                  </View>
                ))}
              </ManagerCard>
            ))}
          </>
        ) : null}
      </View>
      </ScrollView>
    </View>
  );
}

function AddButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.addButton}>
      <Feather name="plus" size={17} color="#2563eb" />
      <Text style={styles.addButtonText}>{label}</Text>
    </Pressable>
  );
}

function RemoveButton({ label, onPress }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.removeButton}
    >
      <Feather name="trash-2" size={16} color="#ef4444" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  settingsScroll: { flex: 1 },
  scrollContent: { paddingBottom: 1 },
  saveBar: {
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  saveCopy: { flex: 1, fontSize: 11, lineHeight: 15 },
  saveButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  message: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageText: { flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  tabs: {
    minHeight: 58,
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  tabText: { fontSize: 10, fontWeight: "800" },
  content: { padding: 14, paddingBottom: 36, gap: 10 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 9 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    fontSize: 12,
  },
  flexInput: { flex: 1, minWidth: 0 },
  stackedInput: { marginTop: 8 },
  codeInput: { width: 76 },
  removeButton: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
    backgroundColor: "rgba(239,68,68,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.3)",
    backgroundColor: "rgba(37,99,235,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: { color: "#2563eb", fontSize: 12, fontWeight: "800" },
  cardHeading: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "900" },
  addProvinceRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  squareAdd: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  headingActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  smallAdd: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  cityRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
});
