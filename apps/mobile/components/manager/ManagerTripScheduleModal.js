import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../contexts/ThemeContext";
import { updateTripSchedule } from "../utilities/FirebaseFunctions";

const SCHEDULE_STATUSES = new Set(["CREATED", "LOADED"]);

function inputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value).slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function initialForm(trip = {}) {
  const source = trip || {};
  return {
    plannedDeparture: inputDate(
      source.plannedDeparture ||
        source.departure ||
        source.departureAt ||
        source.scheduledDeparture,
    ),
    estimatedArrival: inputDate(
      source.estimatedArrival ||
        source.eta ||
        source.estimatedArrivalAt ||
        source.arrivalEstimate,
    ),
    plannedLoadingStart: inputDate(
      source.plannedLoadingStart || source.loadingStart,
    ),
  };
}

export default function ManagerTripScheduleModal({
  visible,
  trip,
  trips = [],
  onClose,
  onSaved,
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(trip || null);
  const [form, setForm] = useState(() => initialForm(trip));
  const [query, setQuery] = useState("");
  const [notificationChannels, setNotificationChannels] = useState({
    sms: true,
    email: true,
    push: true,
  });
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return trips
      .filter((item) =>
        SCHEDULE_STATUSES.has(String(item.status || "").toUpperCase()),
      )
      .filter((item) =>
        !term
          ? true
          : [
              item.id,
              item.tripId,
              item.route,
              item.origin,
              item.destination,
              item.truckPlateNumber,
              item.driverName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(term),
      )
      .slice(0, 30);
  }, [query, trips]);

  useEffect(() => {
    if (!visible) return;
    setSelected(trip || null);
    setForm(initialForm(trip));
    setQuery("");
    setNotificationChannels({ sms: true, email: true, push: true });
  }, [trip, visible]);

  const chooseTrip = (item) => {
    setSelected(item);
    setForm(initialForm(item));
  };

  const save = async () => {
    if (!selected?.id) {
      Alert.alert("Select a trip", "Choose a created or loaded trip first.");
      return;
    }
    if (!form.plannedDeparture || !form.estimatedArrival) {
      Alert.alert(
        "Missing schedule",
        "Planned departure and estimated arrival are required.",
      );
      return;
    }
    const departure = new Date(form.plannedDeparture);
    const arrival = new Date(form.estimatedArrival);
    if (
      !Number.isFinite(departure.getTime()) ||
      !Number.isFinite(arrival.getTime()) ||
      arrival <= departure
    ) {
      Alert.alert(
        "Invalid schedule",
        "Estimated arrival must be later than planned departure.",
      );
      return;
    }
    try {
      setSaving(true);
      const notify = Object.values(notificationChannels).some(Boolean);
      await updateTripSchedule({
        tripId: selected.id,
        plannedDeparture: departure.toISOString(),
        estimatedArrival: arrival.toISOString(),
        plannedLoadingStart: form.plannedLoadingStart
          ? new Date(form.plannedLoadingStart).toISOString()
          : null,
        notify,
        notificationChannels,
        notifySms: notificationChannels.sms,
        notifyEmail: notificationChannels.email,
        notifyPush: notificationChannels.push,
      });
      onClose();
      await onSaved?.();
    } catch (error) {
      Alert.alert(
        "Schedule not saved",
        error.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && onClose()}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>
                {trip ? "Edit Trip Schedule" : "Trip Schedule"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Planned loading, departure, arrival, and notifications
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

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {!trip ? (
              <>
                <Field
                  label="Search trip"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Trip ID, route, truck, or Driver"
                  colors={colors}
                />
                {!selected ? (
                  <ScrollView
                    nestedScrollEnabled
                    style={styles.candidates}
                    contentContainerStyle={styles.candidateContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {candidates.map((item) => {
                    const active = selected?.id === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => chooseTrip(item)}
                        style={[
                          styles.candidate,
                          {
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                            backgroundColor: active
                              ? colors.primarySoft
                              : colors.cardMuted,
                          },
                        ]}
                      >
                        <View style={styles.candidateCopy}>
                          <Text
                            style={[styles.candidateTitle, { color: colors.text }]}
                          >
                            {item.tripId || item.id}
                          </Text>
                          <Text
                            style={[
                              styles.candidateMeta,
                              { color: colors.textMuted },
                            ]}
                          >
                            {item.route ||
                              `${item.origin || "Unknown"} → ${item.destination || "Unknown"}`}
                          </Text>
                        </View>
                        <Feather
                          name={active ? "check-circle" : "circle"}
                          size={18}
                          color={active ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                    );
                    })}
                  </ScrollView>
                ) : (
                  <Pressable
                    onPress={() => setSelected(null)}
                    style={styles.changeTrip}
                  >
                    <Feather name="repeat" size={14} color={colors.primary} />
                    <Text
                      style={[styles.changeTripText, { color: colors.primary }]}
                    >
                      Choose a different trip
                    </Text>
                  </Pressable>
                )}
              </>
            ) : null}

            {selected ? (
              <>
                <View
                  style={[
                    styles.tripInfo,
                    {
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tripId, { color: colors.text }]}>
                    {selected.tripId || selected.id}
                  </Text>
                  <Text style={[styles.tripMeta, { color: colors.textMuted }]}>
                    Selected trip reference
                  </Text>
                </View>
                <View style={styles.infoGrid}>
                  <ScheduleInfo
                    label="Truck"
                    value={selected.truckPlateNumber || "Unassigned"}
                    icon="truck"
                    colors={colors}
                  />
                  <ScheduleInfo
                    label="Route"
                    value={
                      selected.route ||
                      `${selected.origin || "Unknown"} → ${selected.destination || "Unknown"}`
                    }
                    icon="map"
                    colors={colors}
                  />
                  <ScheduleInfo
                    label="Type"
                    value={String(
                      selected.tripType || selected.routeType || "HUB_TRANSFER",
                    ).replace(/_/g, " ")}
                    icon="repeat"
                    colors={colors}
                  />
                  <ScheduleInfo
                    label="Status"
                    value={selected.status || "CREATED"}
                    icon="activity"
                    colors={colors}
                  />
                  <ScheduleInfo
                    label="Driver"
                    value={selected.driverName || "Unassigned"}
                    icon="user"
                    colors={colors}
                  />
                  <ScheduleInfo
                    label="Shipments"
                    value={String(
                      selected.shipmentTotal ??
                        selected.totalShipments ??
                        selected.shipments?.length ??
                        0,
                    )}
                    icon="package"
                    colors={colors}
                  />
                </View>
              </>
            ) : null}

            {selected ? (
              <>
                <View style={styles.sectionHeading}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Planned Schedule
                  </Text>
                  <Text
                    style={[styles.sectionHelp, { color: colors.textMuted }]}
                  >
                    Use local date and time in YYYY-MM-DDTHH:mm format.
                  </Text>
                </View>
                <Field
                  label="Planned loading start"
                  value={form.plannedLoadingStart}
                  onChangeText={(value) =>
                    setForm((current) => ({
                      ...current,
                      plannedLoadingStart: value,
                    }))
                  }
                  placeholder="YYYY-MM-DDTHH:mm"
                  colors={colors}
                />
                <Field
                  label="Planned departure *"
                  value={form.plannedDeparture}
                  onChangeText={(value) =>
                    setForm((current) => ({
                      ...current,
                      plannedDeparture: value,
                    }))
                  }
                  placeholder="YYYY-MM-DDTHH:mm"
                  colors={colors}
                />
                <Field
                  label="Estimated arrival *"
                  value={form.estimatedArrival}
                  onChangeText={(value) =>
                    setForm((current) => ({
                      ...current,
                      estimatedArrival: value,
                    }))
                  }
                  placeholder="YYYY-MM-DDTHH:mm"
                  colors={colors}
                />

                <View style={styles.sectionHeading}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Customer Notification
                  </Text>
                  <Text
                    style={[styles.sectionHelp, { color: colors.textMuted }]}
                  >
                    Choose the channels used for this schedule update.
                  </Text>
                </View>
                <View style={styles.channelList}>
                  {[
                    ["sms", "message-circle", "SMS"],
                    ["email", "mail", "Email"],
                    ["push", "bell", "Push Notification"],
                  ].map(([key, icon, label]) => (
                    <View
                      key={key}
                      style={[
                        styles.notify,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.cardMuted,
                        },
                      ]}
                    >
                      <Feather name={icon} size={17} color={colors.primary} />
                      <Text
                        style={[styles.channelLabel, { color: colors.text }]}
                      >
                        {label}
                      </Text>
                      <Switch
                        value={notificationChannels[key]}
                        onValueChange={(value) =>
                          setNotificationChannels((current) => ({
                            ...current,
                            [key]: value,
                          }))
                        }
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.button, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={save}
              style={[styles.button, styles.saveButton]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#fff" />
                  <Text style={styles.saveText}>Save Schedule</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ScheduleInfo({ label, value, icon, colors }) {
  return (
    <View
      style={[
        styles.infoCard,
        { borderColor: colors.border, backgroundColor: colors.cardMuted },
      ]}
    >
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={[styles.infoValue, { color: colors.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function Field({ label, colors, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.cardMuted,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.58)",
  },
  sheet: {
    maxHeight: "94%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 3, fontSize: 11, lineHeight: 16 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 18, paddingBottom: 22, gap: 13 },
  field: { gap: 5 },
  label: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  input: {
    minHeight: 47,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  candidates: { maxHeight: 220 },
  candidateContent: { gap: 7 },
  changeTrip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  changeTripText: { fontSize: 11, fontWeight: "800" },
  candidate: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 13,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  candidateCopy: { flex: 1 },
  candidateTitle: { fontSize: 12, fontWeight: "900" },
  candidateMeta: { marginTop: 3, fontSize: 10 },
  tripInfo: { borderWidth: 1, borderRadius: 14, padding: 13 },
  tripId: { fontSize: 14, fontWeight: "900" },
  tripMeta: { marginTop: 4, fontSize: 10 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCard: {
    width: "48.5%",
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  infoLabel: { marginTop: 7, fontSize: 8, fontWeight: "900" },
  infoValue: { marginTop: 3, fontSize: 11, lineHeight: 15, fontWeight: "800" },
  sectionHeading: { marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "900" },
  sectionHelp: { marginTop: 3, fontSize: 10, lineHeight: 14 },
  channelList: { gap: 8 },
  notify: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  channelLabel: { flex: 1, fontSize: 12, fontWeight: "800" },
  notifyCopy: { flex: 1 },
  notifyTitle: { fontSize: 12, fontWeight: "800" },
  notifyMeta: { marginTop: 3, fontSize: 10, lineHeight: 14 },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  button: {
    flex: 1,
    minHeight: 49,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButton: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  cancelText: { fontWeight: "800" },
  saveText: { color: "#fff", fontWeight: "900" },
});
