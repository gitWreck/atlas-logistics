import React, { useEffect, useState } from "react";
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
import {
  createInvoice,
  createUserProfile,
  upsertTruck,
} from "../utilities/FirebaseFunctions";
import { DELIVERY_MUNICIPALITIES } from "../utilities/deliveryMunicipalities";

const EMPTY = {
  plateNumber: "",
  model: "",
  type: "10-Wheeler Wing Van",
  payloadCapacity: "",
  currentOdometer: "0",
  lastPmsOdometer: "0",
  status: "IDLE",
  registrationExpiry: "",
  lastOilChange: "",
  lastTireChange: "",
  email: "",
  password: "",
  displayName: "",
  phoneNumber: "",
  city: "",
  shipmentId: "",
  billingName: "",
  billingAddress: "",
  amount: "",
  dueDate: "",
  invoiceDate: "",
  notes: "",
  shipmentStatus: "",
  truckTripId: "",
  routeLabel: "",
  senderName: "",
  recipientName: "",
  totalPackages: "0",
  totalItems: "0",
  province: "",
  barangay: "",
  street: "",
  warehouseCode: "",
  warehouseName: "",
  role: "driver",
};

const CONFIG = {
  trucks: {
    title: "Register Truck",
    fields: [
      ["plateNumber", "Plate Number"],
      ["model", "Truck Model"],
      ["type", "Truck Type"],
      ["payloadCapacity", "Payload Capacity (kg)", "numeric"],
      ["currentOdometer", "Current Odometer", "numeric"],
      ["lastPmsOdometer", "Last PMS Odometer", "numeric"],
    ],
  },
  customers: {
    title: "Add Customer",
    fields: [
      ["displayName", "Full Name"],
      ["email", "Email", "email-address"],
      ["password", "Temporary Password", "default", true],
      ["phoneNumber", "Phone"],
      ["city", "Municipality"],
    ],
  },
  staff: {
    title: "Add New User",
    fields: [],
  },
  invoices: {
    title: "Create Invoice",
    fields: [
      ["shipmentId", "Shipment ID"],
      ["billingName", "Billing Name"],
      ["billingAddress", "Billing Address"],
      ["amount", "Amount", "numeric"],
      ["dueDate", "Due Date (YYYY-MM-DD)"],
    ],
  },
};

export default function ManagerQuickCreateModal({
  type,
  visible,
  scope,
  settings,
  shipments = [],
  initialValues,
  onClose,
  onCreated,
}) {
  const { colors } = useTheme();
  const config = CONFIG[type];
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const truckTypes =
    Array.isArray(settings?.truckTypes) && settings.truckTypes.length
      ? settings.truckTypes
      : [
          "12-Wheeler Wing Van",
          "12-Wheeler Closed Van",
          "10-Wheeler Wing Van",
          "10-Wheeler Dropside",
          "8-Wheeler Wing Van",
          "6-Wheeler Closed Van",
          "6-Wheeler Boom Truck",
          "6-Wheeler Wing Van",
          "4-Wheeler Reefer",
        ];
  useEffect(() => {
    if (visible) {
      setReviewing(false);
      setForm({
        ...EMPTY,
        invoiceDate:
          type === "invoices" ? new Date().toISOString().slice(0, 10) : "",
        ...(initialValues || {}),
      });
    }
  }, [visible, type, initialValues]);
  if (!config) return null;

  const submit = async () => {
    try {
      setSaving(true);
      if (type === "trucks") {
        const payloadCapacity = Number(form.payloadCapacity);
        const currentOdometer = Number(form.currentOdometer);
        const lastPmsOdometer = Number(form.lastPmsOdometer);
        const lastOilChange =
          form.lastOilChange === "" ? null : Number(form.lastOilChange);
        const lastTireChange =
          form.lastTireChange === "" ? null : Number(form.lastTireChange);
        const validExpiry =
          /^\d{4}-\d{2}-\d{2}$/.test(form.registrationExpiry) &&
          Number.isFinite(new Date(`${form.registrationExpiry}T00:00:00`).getTime());
        if (
          !form.plateNumber.trim() ||
          !form.model.trim() ||
          !form.type ||
          !form.registrationExpiry ||
          !validExpiry ||
          !Number.isFinite(payloadCapacity) ||
          payloadCapacity <= 0 ||
          !Number.isFinite(currentOdometer) ||
          currentOdometer < 0 ||
          !Number.isFinite(lastPmsOdometer) ||
          lastPmsOdometer < 0
        ) {
          throw new Error("Complete all required truck and maintenance fields.");
        }
        if (lastPmsOdometer > currentOdometer) {
          throw new Error("Last PMS odometer cannot exceed the current odometer.");
        }
        if (
          (lastOilChange !== null &&
            (!Number.isFinite(lastOilChange) ||
              lastOilChange < 0 ||
              lastOilChange > currentOdometer)) ||
          (lastTireChange !== null &&
            (!Number.isFinite(lastTireChange) ||
              lastTireChange < 0 ||
              lastTireChange > currentOdometer))
        ) {
          throw new Error(
            "Oil and tire change readings must be valid and cannot exceed the current odometer.",
          );
        }
        await upsertTruck({
          ...form,
          plateNumber: form.plateNumber.toUpperCase(),
          payloadCapacity,
          currentOdometer,
          lastPmsOdometer,
          lastOilChange,
          lastTireChange,
          warehouseCode: scope?.warehouses?.[0],
        });
      } else if (type === "customers") {
        await createUserProfile({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          role: "customer",
          phoneNumber: form.phoneNumber,
          province: form.province,
          city: form.city,
          barangay: form.barangay,
          street: form.street,
          warehouseCode: scope?.warehouses?.[0],
          warehouseName: scope?.warehouses?.[0],
        });
      } else if (type === "staff") {
        await createUserProfile({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          role: form.role,
          phoneNumber: form.phoneNumber,
          warehouseCode: form.warehouseCode || null,
          warehouseName: form.warehouseName || null,
          province: form.province,
          city: form.city,
          barangay: form.barangay,
          street: form.street,
        });
      } else {
        const validInvoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(form.invoiceDate);
        const validDueDate = /^\d{4}-\d{2}-\d{2}$/.test(form.dueDate);
        if (
          !form.shipmentId ||
          !form.billingName.trim() ||
          !form.invoiceDate ||
          !form.dueDate ||
          !validInvoiceDate ||
          !validDueDate ||
          !Number.isFinite(Number(form.amount)) ||
          Number(form.amount) < 0
        ) {
          throw new Error(
            "Select a shipment and complete the invoice date, due date, billing name, and amount.",
          );
        }
        if (
          new Date(`${form.dueDate}T00:00:00`) <
          new Date(`${form.invoiceDate}T00:00:00`)
        ) {
          throw new Error("Due date cannot be earlier than the invoice date.");
        }
        await createInvoice({
          shipmentId: form.shipmentId.trim(),
          billingName: form.billingName.trim(),
          billingAddress: form.billingAddress.trim(),
          amount: Number(form.amount),
          invoiceDate: form.invoiceDate,
          dueDate: form.dueDate || null,
          notes: form.notes.trim(),
          status: "DRAFT",
        });
      }
      setReviewing(false);
      onClose();
      await onCreated?.();
    } catch (error) {
      Alert.alert(`${config.title} failed`, error.message || "Please check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitle}>
              <Feather
                name={
                  type === "trucks"
                    ? "truck"
                    : type === "invoices"
                      ? "file-text"
                      : ["customers", "staff"].includes(type)
                        ? "user-plus"
                      : "plus-circle"
                }
                size={19}
                color="#2563eb"
              />
              <View style={styles.headerTitleCopy}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {type === "trucks" ? "Register New Truck" : config.title}
                </Text>
                {type === "invoices" ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.headerSubtitle, { color: colors.textMuted }]}
                  >
                    {form.shipmentId || "No shipment selected"}
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.cardMuted }]}
            >
              <Feather name="x" size={21} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            {reviewing && ["customers", "staff"].includes(type) ? (
              <UserReview form={form} type={type} colors={colors} />
            ) : type === "trucks" ? (
              <TruckForm
                form={form}
                setForm={setForm}
                truckTypes={truckTypes}
                colors={colors}
              />
            ) : type === "invoices" ? (
              <InvoiceForm
                form={form}
                setForm={setForm}
                shipments={shipments}
                colors={colors}
              />
            ) : ["customers", "staff"].includes(type) ? (
              <UserForm
                form={form}
                setForm={setForm}
                type={type}
                settings={settings}
                scope={scope}
                colors={colors}
                onReview={() => {
                  if (
                    !form.displayName.trim() ||
                    !form.email.trim() ||
                    form.password.length < 6
                  ) {
                    Alert.alert(
                      "Missing information",
                      "Name, email, and a temporary password of at least 6 characters are required.",
                    );
                    return;
                  }
                  if (
                    type === "staff" &&
                    !["admin", "customer"].includes(form.role) &&
                    !form.warehouseCode
                  ) {
                    Alert.alert(
                      "Warehouse required",
                      "Select the warehouse base for this staff account.",
                    );
                    return;
                  }
                  setReviewing(true);
                }}
              />
            ) : config.fields.map(([field, label, keyboardType = "default", secure = false]) => (
              <View key={field} style={styles.field}>
                <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
                <TextInput
                  value={form[field]}
                  onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))}
                  keyboardType={keyboardType}
                  secureTextEntry={secure}
                  autoCapitalize={field === "email" ? "none" : "sentences"}
                  style={[styles.input, { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border }]}
                  placeholder={label}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))}
          </ScrollView>
          {!["customers", "staff"].includes(type) || reviewing ? (
          <View style={styles.actions}>
            <Pressable
              disabled={saving}
              onPress={() =>
                reviewing ? setReviewing(false) : onClose()
              }
              style={[styles.button, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancel, { color: colors.text }]}>
                {reviewing ? "Go Back" : "Cancel"}
              </Text>
            </Pressable>
            <Pressable disabled={saving} onPress={submit} style={[styles.button, styles.save, saving && styles.disabled]}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.saveContent}>
                  <Feather name="save" size={16} color="#fff" />
                  <Text style={styles.saveText}>
                    {reviewing
                      ? "Confirm"
                      : type === "invoices"
                        ? "Save Invoice"
                        : "Save"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TruckForm({ form, setForm, truckTypes, colors }) {
  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  return (
    <View style={styles.truckForm}>
      <View style={styles.row}>
        <View style={styles.half}>
          <TruckField
            label="Plate Number *"
            icon="truck"
            value={form.plateNumber}
            onChangeText={(value) => set("plateNumber", value)}
            placeholder="ABC-1234"
            autoCapitalize="characters"
            colors={colors}
          />
        </View>
        <View style={styles.half}>
          <TruckField
            label="Truck Model *"
            value={form.model}
            onChangeText={(value) => set("model", value)}
            placeholder="Isuzu Giga"
            colors={colors}
          />
        </View>
      </View>

      <Panel title="Truck Type" icon="truck" colors={colors} accent="#2563eb">
        <SelectField
          value={form.type}
          options={truckTypes}
          onChange={(value) => set("type", value)}
          label="Truck Type"
          colors={colors}
        />
      </Panel>

      <Panel title="Truck Status" icon="check" colors={colors} accent="#2563eb">
        <SelectField
          value={form.status}
          options={[
            "IDLE",
            "ACTIVE",
            "ASSIGNED",
            "IN_TRANSIT",
            "MAINTENANCE",
            "DISABLED",
            "OUT_OF_SERVICE",
          ]}
          onChange={(value) => set("status", value)}
          label="Truck Status"
          colors={colors}
        />
      </Panel>

      <TruckField
        label="Max Payload (KG) *"
        icon="briefcase"
        value={form.payloadCapacity}
        onChangeText={(value) => set("payloadCapacity", value)}
        keyboardType="decimal-pad"
        placeholder="e.g. 24000"
        colors={colors}
      />

      <Panel
        title="Maintenance & Compliance"
        icon="tool"
        colors={colors}
        accent="#059669"
      >
        <View style={styles.row}>
          <View style={styles.half}>
            <TruckField
              label="LTO Expiry *"
              icon="calendar"
              value={form.registrationExpiry}
              onChangeText={(value) => set("registrationExpiry", value)}
              placeholder="YYYY-MM-DD"
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <TruckField
              label="Last PMS ODO *"
              icon="tool"
              value={form.lastPmsOdometer}
              onChangeText={(value) => set("lastPmsOdometer", value)}
              keyboardType="number-pad"
              placeholder="e.g. 45000"
              colors={colors}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <TruckField
              label="Current ODO *"
              value={form.currentOdometer}
              onChangeText={(value) => set("currentOdometer", value)}
              keyboardType="number-pad"
              placeholder="e.g. 47000"
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <TruckField
              label="Last Oil Change (ODO)"
              icon="tool"
              value={form.lastOilChange}
              onChangeText={(value) => set("lastOilChange", value)}
              keyboardType="number-pad"
              placeholder="e.g. 50000"
              colors={colors}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <TruckField
              label="Last Tires Change (ODO)"
              icon="tool"
              value={form.lastTireChange}
              onChangeText={(value) => set("lastTireChange", value)}
              keyboardType="number-pad"
              placeholder="e.g. 40000"
              colors={colors}
            />
          </View>
          <View style={styles.half} />
        </View>
      </Panel>
    </View>
  );
}

function contactName(contact = {}) {
  return (
    contact.name ||
    contact.fullName ||
    contact.displayName ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ")
  );
}

function addressText(contact = {}) {
  if (contact.formattedAddress) return contact.formattedAddress;
  const address = contact.address || contact;
  return [
    address.unit,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
}

function shipmentTripId(shipment = {}) {
  return (
    shipment.currentTripId ||
    shipment.tripId ||
    (Array.isArray(shipment.currentTripIds)
      ? shipment.currentTripIds.join(", ")
      : "")
  );
}

function InvoiceForm({ form, setForm, shipments, colors }) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const eligibleShipments = shipments.filter(
    (shipment) =>
      shipment.hasInvoice !== true ||
      String(shipment.invoiceStatus || "").toUpperCase() === "CANCELLED",
  );
  const filtered = eligibleShipments
    .filter((shipment) => {
      const text = [
        shipment.id,
        shipment.shipmentId,
        shipment.trackingNumber,
        contactName(shipment.sender),
        contactName(shipment.recipient),
        shipment.origin,
        shipment.destination,
        shipmentTripId(shipment),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(query.trim().toLowerCase());
    })
    .slice(0, 50);

  const selectShipment = (shipment) => {
    const shipmentId =
      shipment.id || shipment.shipmentId || shipment.trackingNumber || "";
    const senderName = contactName(shipment.sender);
    const recipientName = contactName(shipment.recipient);
    const totalPackages = Array.isArray(shipment.packages)
      ? shipment.packages.length
      : Number(shipment.totals?.totalItems || 0);
    const totalItems =
      Number(shipment.totals?.totalContentQty) ||
      Number(shipment.totals?.totalItems) ||
      (shipment.packages || []).reduce(
        (total, item) => total + Math.max(Number(item.quantity) || 1, 1),
        0,
      );
    setForm((current) => ({
      ...current,
      shipmentId,
      shipmentStatus: shipment.status || "",
      truckTripId: shipmentTripId(shipment),
      billingName: senderName,
      billingAddress: addressText(shipment.sender),
      routeLabel: `${shipment.origin || "Unknown"} → ${
        shipment.destination || "Unknown"
      }`,
      senderName,
      recipientName,
      totalPackages: String(totalPackages || 0),
      totalItems: String(totalItems || 0),
    }));
    setSelectorOpen(false);
    setQuery("");
  };

  return (
    <View style={styles.invoiceForm}>
      <View style={styles.invoiceSection}>
        <Text style={[styles.invoiceSectionTitle, { color: colors.text }]}>
          Shipment Reference
        </Text>
        <Text style={[styles.invoiceHelper, { color: colors.textMuted }]}>
          Auto-filled from the connected shipment
        </Text>
        <Pressable
          onPress={() => setSelectorOpen(true)}
          style={[
            styles.shipmentSelector,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.shipmentSelectorCopy}>
            <Text style={[styles.label, styles.labelNoMargin, { color: colors.textMuted }]}>
              SHIPMENT
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.shipmentSelectorValue,
                { color: form.shipmentId ? colors.text : colors.textMuted },
              ]}
            >
              {form.shipmentId || "Search shipment ID, sender, recipient..."}
            </Text>
          </View>
          <Feather name="search" size={17} color="#2563eb" />
        </Pressable>
        <View style={styles.row}>
          <View style={styles.half}>
            <InvoiceField
              label="Shipment Status"
              value={form.shipmentStatus}
              editable={false}
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <InvoiceField
              label="Trip ID"
              value={form.truckTripId}
              editable={false}
              colors={colors}
            />
          </View>
        </View>
      </View>

      <View style={styles.invoiceSection}>
        <Text style={[styles.invoiceSectionTitle, { color: colors.text }]}>
          Invoice Details
        </Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <InvoiceField
              label="Invoice Date *"
              value={form.invoiceDate}
              onChangeText={(value) => set("invoiceDate", value)}
              placeholder="YYYY-MM-DD"
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <InvoiceField
              label="Due Date *"
              value={form.dueDate}
              onChangeText={(value) => set("dueDate", value)}
              placeholder="YYYY-MM-DD"
              colors={colors}
            />
          </View>
        </View>
        <InvoiceField
          label="Amount *"
          value={form.amount}
          onChangeText={(value) => set("amount", value)}
          keyboardType="decimal-pad"
          placeholder="0"
          colors={colors}
        />
      </View>

      <View style={styles.invoiceSection}>
        <Text style={[styles.invoiceSectionTitle, { color: colors.text }]}>
          Billing Information
        </Text>
        <InvoiceField
          label="Billing Name *"
          value={form.billingName}
          onChangeText={(value) => set("billingName", value)}
          colors={colors}
        />
        <InvoiceField
          label="Route"
          value={form.routeLabel}
          editable={false}
          colors={colors}
        />
        <InvoiceField
          label="Billing Address"
          value={form.billingAddress}
          onChangeText={(value) => set("billingAddress", value)}
          multiline
          colors={colors}
        />
      </View>

      <View style={styles.invoiceSection}>
        <Text style={[styles.invoiceSectionTitle, { color: colors.text }]}>
          Package Summary
        </Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <InvoiceField
              label="Sender"
              value={form.senderName}
              editable={false}
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <InvoiceField
              label="Recipient"
              value={form.recipientName}
              editable={false}
              colors={colors}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <InvoiceField
              label="Total Packages"
              value={form.totalPackages}
              editable={false}
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <InvoiceField
              label="Total Items"
              value={form.totalItems}
              editable={false}
              colors={colors}
            />
          </View>
        </View>
      </View>

      <View style={styles.invoiceSection}>
        <Text style={[styles.invoiceSectionTitle, { color: colors.text }]}>
          Notes
        </Text>
        <InvoiceField
          label="Optional notes or billing remarks"
          value={form.notes}
          onChangeText={(value) => set("notes", value)}
          placeholder="Optional notes or billing remarks..."
          multiline
          colors={colors}
        />
      </View>

      <Modal
        visible={selectorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectorOpen(false)}
      >
        <Pressable
          style={styles.selectBackdrop}
          onPress={() => setSelectorOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.shipmentSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.selectHeader}>
              <View style={styles.shipmentSheetTitle}>
                <Text style={[styles.selectTitle, { color: colors.text }]}>
                  Select Shipment
                </Text>
                <Text style={[styles.invoiceHelper, { color: colors.textMuted }]}>
                  Authorized shipments without an active invoice
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectorOpen(false)}
                style={[styles.close, { backgroundColor: colors.cardMuted }]}
              >
                <Feather name="x" size={19} color={colors.text} />
              </Pressable>
            </View>
            <View
              style={[
                styles.shipmentSearch,
                { backgroundColor: colors.cardMuted, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Shipment ID, sender, recipient..."
                placeholderTextColor={colors.textMuted}
                style={[styles.shipmentSearchInput, { color: colors.text }]}
              />
            </View>
            <ScrollView
              style={styles.shipmentResults}
              contentContainerStyle={styles.selectOptionsContent}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.map((shipment) => (
                <Pressable
                  key={shipment.id}
                  onPress={() => selectShipment(shipment)}
                  style={[
                    styles.shipmentResult,
                    { backgroundColor: colors.cardMuted, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.shipmentResultId, { color: colors.text }]}>
                    {shipment.trackingNumber || shipment.shipmentId || shipment.id}
                  </Text>
                  <Text
                    style={[styles.shipmentResultMeta, { color: colors.textMuted }]}
                  >
                    {contactName(shipment.sender) || "Unknown Sender"} →{" "}
                    {contactName(shipment.recipient) || "Unknown Recipient"}
                  </Text>
                  <Text
                    style={[styles.shipmentResultMeta, { color: colors.textMuted }]}
                  >
                    {shipment.origin || "Unknown"} →{" "}
                    {shipment.destination || "Unknown"}
                  </Text>
                </Pressable>
              ))}
              {!filtered.length ? (
                <Text style={[styles.noResults, { color: colors.textMuted }]}>
                  No eligible shipments found.
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function InvoiceField({ label, colors, multiline = false, editable = true, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        {...props}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.invoiceMultiline,
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

function UserForm({
  form,
  setForm,
  type,
  settings,
  scope,
  colors,
  onReview,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const isCustomer = type === "customers" || form.role === "customer";
  const warehouses = (settings?.warehouses || []).map((warehouse) =>
    typeof warehouse === "string"
      ? { value: warehouse, label: warehouse, name: warehouse }
      : {
          value: warehouse.code || warehouse.id || warehouse.name,
          label: warehouse.name || warehouse.code,
          name: warehouse.name || warehouse.code,
        },
  );
  const phLocations =
    settings?.phLocations && typeof settings.phLocations === "object"
      ? settings.phLocations
      : {};
  const provinces = Object.keys(phLocations).sort();
  const provinceOptions = provinces.length ? provinces : ["Romblon"];
  const rawCities = phLocations[form.province] || [];
  const configuredCities = rawCities
    .map((city) => (typeof city === "string" ? city : city.name))
    .filter(Boolean);
  const scopedCities = (scope?.municipalities || []).map(String).filter(Boolean);
  const cityOptions =
    configuredCities.length
      ? configuredCities
      : scopedCities.length
        ? scopedCities
        : form.province === "Romblon"
          ? DELIVERY_MUNICIPALITIES
          : [];

  return (
    <View style={styles.userForm}>
      <InvoiceField
        label="Name *"
        value={form.displayName}
        onChangeText={(value) => set("displayName", value)}
        placeholder="e.g. Juan Dela Cruz"
        colors={colors}
      />
      <InvoiceField
        label="Email *"
        value={form.email}
        onChangeText={(value) => set("email", value)}
        placeholder="user@atlas.com"
        keyboardType="email-address"
        autoCapitalize="none"
        colors={colors}
      />
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          TEMPORARY PASSWORD *
        </Text>
        <View
          style={[
            styles.passwordControl,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TextInput
            value={form.password}
            onChangeText={(value) => set("password", value)}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            style={[styles.passwordInput, { color: colors.text }]}
          />
          <Pressable
            onPress={() => setShowPassword((current) => !current)}
            style={styles.passwordEye}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={19}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
      </View>
      <InvoiceField
        label="Phone Number"
        value={form.phoneNumber}
        onChangeText={(value) => set("phoneNumber", value)}
        placeholder="0917 123 4567"
        keyboardType="phone-pad"
        colors={colors}
      />

      {type === "staff" ? (
        <SelectField
          value={form.role}
          options={[
            { value: "driver", label: "Driver" },
            { value: "checker", label: "Checker" },
            { value: "manager", label: "Manager" },
            { value: "admin", label: "Admin" },
            { value: "customer", label: "Customer" },
          ]}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              role: value,
              warehouseCode:
                value === "admin" || value === "customer"
                  ? ""
                  : current.warehouseCode,
              warehouseName:
                value === "admin" || value === "customer"
                  ? ""
                  : current.warehouseName,
            }))
          }
          label="Role"
          fieldLabel="Role"
          colors={colors}
        />
      ) : null}

      {isCustomer ? (
        <View
          style={[styles.addressSection, { borderTopColor: colors.border }]}
        >
          <Text style={styles.addressTitle}>Address Details</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <SelectField
                value={form.province}
                options={provinceOptions}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    province: value,
                    city: "",
                  }))
                }
                label="Province"
                fieldLabel="Province"
                placeholder="Select Province"
                colors={colors}
              />
            </View>
            <View style={styles.half}>
              <SelectField
                value={form.city}
                options={cityOptions}
                onChange={(value) => set("city", value)}
                label="City / Municipality"
                fieldLabel="City / Municipality"
                placeholder="Select City"
                disabled={!form.province}
                colors={colors}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <InvoiceField
                label="Barangay"
                value={form.barangay}
                onChangeText={(value) => set("barangay", value)}
                placeholder="Barangay"
                colors={colors}
              />
            </View>
            <View style={styles.half}>
              <InvoiceField
                label="Street"
                value={form.street}
                onChangeText={(value) => set("street", value)}
                placeholder="Street Name"
                colors={colors}
              />
            </View>
          </View>
        </View>
      ) : form.role !== "admin" ? (
        <SelectField
          value={form.warehouseCode}
          options={warehouses}
          onChange={(value) => {
            const selected = warehouses.find((entry) => entry.value === value);
            setForm((current) => ({
              ...current,
              warehouseCode: value,
              warehouseName: selected?.name || selected?.label || value,
            }));
          }}
          label="Assign Warehouse Base"
          fieldLabel="Assign Warehouse Base"
          placeholder="Select Warehouse..."
          colors={colors}
        />
      ) : null}

      <Pressable onPress={onReview} style={styles.reviewButton}>
        <Text style={styles.reviewButtonText}>Review Details</Text>
      </Pressable>
    </View>
  );
}

function UserReview({ form, type, colors }) {
  const role = type === "customers" ? "customer" : form.role;
  return (
    <View style={styles.userReview}>
      <View style={styles.reviewWarning}>
        <Feather name="alert-triangle" size={25} color="#d97706" />
      </View>
      <Text style={[styles.reviewTitle, { color: colors.text }]}>
        Are you sure?
      </Text>
      <Text style={[styles.reviewCopy, { color: colors.textMuted }]}>
        Creating a {role} account for:
      </Text>
      <Text style={[styles.reviewName, { color: colors.text }]}>
        {form.displayName}
      </Text>
      <Text style={[styles.reviewCopy, { color: colors.textMuted }]}>
        {form.email}
      </Text>
      <Text style={[styles.reviewHelper, { color: colors.textMuted }]}>
        A 9-digit system ID will be generated automatically.
      </Text>
      {role === "customer" ? (
        <Text style={[styles.reviewHelper, { color: colors.textMuted }]}>
          Address: {[form.barangay, form.city, form.province]
            .filter(Boolean)
            .join(", ") || "Not provided"}
        </Text>
      ) : (
        <Text style={[styles.reviewHelper, { color: colors.textMuted }]}>
          Warehouse: {form.warehouseName || "Not assigned"}
        </Text>
      )}
    </View>
  );
}

function Panel({ title, icon, accent, colors, children }) {
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.cardMuted, borderColor: colors.border },
      ]}
    >
      <View style={styles.panelTitle}>
        <Feather name={icon} size={14} color={accent} />
        <Text style={[styles.panelTitleText, { color: accent }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function TruckField({ label, icon, colors, ...props }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        {icon ? <Feather name={icon} size={12} color={colors.textMuted} /> : null}
        <Text style={[styles.label, styles.labelNoMargin, { color: colors.textMuted }]}>
          {label}
        </Text>
      </View>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

function SelectField({
  value,
  options,
  onChange,
  label,
  fieldLabel,
  placeholder = "Select...",
  disabled = false,
  colors,
}) {
  const [open, setOpen] = useState(false);
  const normalizedOptions = options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : option,
  );
  const selectedLabel =
    normalizedOptions.find((option) => option.value === value)?.label || value;
  return (
    <View style={fieldLabel ? styles.field : undefined}>
      {fieldLabel ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {fieldLabel.toUpperCase()}
        </Text>
      ) : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.selectControl,
          { backgroundColor: colors.surface, borderColor: colors.border },
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.selectValue,
            { color: selectedLabel ? colors.text : colors.textMuted },
          ]}
        >
          {selectedLabel
            ? String(selectedLabel).replace(/_/g, " ")
            : placeholder}
        </Text>
        <Feather name="chevron-down" size={17} color={colors.textMuted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.selectBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.selectSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.selectHeader}>
              <Text style={[styles.selectTitle, { color: colors.text }]}>
                {label}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                style={[styles.close, { backgroundColor: colors.cardMuted }]}
              >
                <Feather name="x" size={19} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.selectOptions}
              contentContainerStyle={styles.selectOptionsContent}
            >
              {normalizedOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.selectOption,
                    {
                      backgroundColor:
                        value === option.value ? "#eff6ff" : colors.cardMuted,
                      borderColor:
                        value === option.value ? "#93c5fd" : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      {
                        color:
                          value === option.value ? "#2563eb" : colors.text,
                      },
                    ]}
                  >
                    {String(option.label).replace(/_/g, " ")}
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: { maxHeight: "94%", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 24 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerTitle: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  headerTitleCopy: { flex: 1, minWidth: 0 },
  headerSubtitle: { fontSize: 10, marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 19, fontWeight: "900" },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  form: { marginTop: 15, flexGrow: 0 },
  truckForm: { gap: 13, paddingBottom: 8 },
  invoiceForm: { gap: 20, paddingBottom: 8 },
  userForm: { gap: 4, paddingBottom: 8 },
  passwordControl: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingLeft: 13, flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, minWidth: 0, padding: 0, fontSize: 14 },
  passwordEye: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  addressSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 10, marginTop: 3 },
  addressTitle: { color: "#2563eb", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  reviewButton: { minHeight: 54, borderRadius: 13, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", marginTop: 4 },
  reviewButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  userReview: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 28 },
  reviewWarning: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fffbeb", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  reviewTitle: { fontSize: 20, fontWeight: "900" },
  reviewCopy: { fontSize: 12, textAlign: "center", marginTop: 8 },
  reviewName: { fontSize: 16, fontWeight: "900", textAlign: "center", marginTop: 6 },
  reviewHelper: { fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 10 },
  invoiceSection: { gap: 10 },
  invoiceSectionTitle: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  invoiceHelper: { fontSize: 10, lineHeight: 14, marginTop: -5 },
  shipmentSelector: { minHeight: 58, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  shipmentSelectorCopy: { flex: 1, minWidth: 0, gap: 5 },
  shipmentSelectorValue: { fontSize: 12, fontWeight: "700" },
  invoiceMultiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  shipmentSheet: { maxHeight: "82%", borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 24 },
  shipmentSheetTitle: { flex: 1, minWidth: 0, gap: 6 },
  shipmentSearch: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 11 },
  shipmentSearchInput: { flex: 1, padding: 0, fontSize: 12 },
  shipmentResults: { flexGrow: 0 },
  shipmentResult: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  shipmentResultId: { fontSize: 12, fontWeight: "900" },
  shipmentResultMeta: { fontSize: 10, lineHeight: 14 },
  noResults: { textAlign: "center", paddingVertical: 24, fontSize: 11 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  half: { flex: 1, minWidth: 0 },
  panel: { borderWidth: 1, borderRadius: 14, padding: 13, gap: 11 },
  panelTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  panelTitleText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.35 },
  field: { marginBottom: 12 },
  fieldLabel: { minHeight: 18, flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  label: { fontSize: 10, fontWeight: "900", marginBottom: 5, textTransform: "uppercase" },
  labelNoMargin: { marginBottom: 0 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  selectControl: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  selectValue: { flex: 1, fontSize: 12, fontWeight: "700" },
  selectBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.58)" },
  selectSheet: { maxHeight: "72%", borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 24 },
  selectHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  selectTitle: { fontSize: 17, fontWeight: "900" },
  selectOptions: { flexGrow: 0 },
  selectOptionsContent: { gap: 7 },
  selectOption: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectOptionText: { fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  button: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  save: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  cancel: { fontWeight: "800" },
  saveText: { color: "#fff", fontWeight: "900" },
  saveContent: { flexDirection: "row", alignItems: "center", gap: 7 },
  disabled: { opacity: 0.6 },
});
