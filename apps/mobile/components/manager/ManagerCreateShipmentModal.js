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
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTheme } from "../../contexts/ThemeContext";
import { storage } from "../../firebase";
import {
  createShipment,
  updateShipmentImages,
} from "../utilities/FirebaseFunctions";
import { DELIVERY_MUNICIPALITIES } from "../utilities/deliveryMunicipalities";

const EMPTY_CONTACT = {
  name: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  unit: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
};

const DEFAULT_ITEM = {
  description: "",
  packagingType: "Box",
  quantity: "1",
  declaredValue: "",
  packagingGroup: "SINGLE",
  isFragile: false,
  isPerishable: false,
};

const EMPTY_FORM = {
  mode: "dropoff",
  sender: { ...EMPTY_CONTACT },
  recipient: { ...EMPTY_CONTACT },
  municipality: "",
  origin: "",
  destination: "",
  items: [{ ...DEFAULT_ITEM }],
  remarks: "",
  photos: [],
};

const PACKAGING_TYPES = [
  "Box",
  "Bundle",
  "Bag",
  "Envelope",
  "Crate",
  "Pallet",
  "Sack",
  "Other",
];

function warehouseLabel(value = "") {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (normalized === "div" || normalized.includes("divisoria")) {
    return "Divisoria";
  }
  if (normalized === "odi" || normalized.includes("odiongan")) {
    return "Odiongan";
  }
  return text;
}

function warehouseCode(value = "") {
  const label = warehouseLabel(value);
  if (label === "Divisoria") return "DIV";
  if (label === "Odiongan") return "ODI";
  return label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 5)
    .toUpperCase();
}

export default function ManagerCreateShipmentModal({
  visible,
  scope,
  onClose,
  onCreated,
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const warehouses = useMemo(
    () => [...new Set((scope?.warehouses || []).map(String).filter(Boolean))],
    [scope],
  );
  const warehouseOptions = useMemo(
    () =>
      [
        ...new Set(
          [...warehouses, "Divisoria", "Odiongan"]
            .map(warehouseLabel)
            .filter(Boolean),
        ),
      ],
    [warehouses],
  );
  const municipalities = useMemo(
    () => {
      const assigned = (scope?.municipalities || []).map(String).filter(Boolean);
      return assigned.length ? [...new Set(assigned)] : DELIVERY_MUNICIPALITIES;
    },
    [scope],
  );

  useEffect(() => {
    if (!visible) return;
    const warehouse = warehouseOptions[0] || "";
    const destination =
      warehouseOptions.find((value) => value !== warehouse) || "";
    const municipality = municipalities[0] || "";
    setForm({
      ...EMPTY_FORM,
      sender: { ...EMPTY_CONTACT },
      recipient: { ...EMPTY_CONTACT, city: municipality },
      items: [{ ...DEFAULT_ITEM }],
      origin: warehouse,
      destination,
      municipality,
      photos: [],
    });
  }, [visible, warehouseOptions, municipalities]);

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const setContact = (type, field, value) =>
    setForm((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  const setItem = (index, field, value) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  const addItem = () =>
    setForm((current) => ({
      ...current,
      items: [...current.items, { ...DEFAULT_ITEM }],
    }));
  const removeItem = (index) =>
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));

  const choosePhoto = async (camera = false) => {
    if (form.photos.length >= 5) {
      Alert.alert("Photo limit", "You can attach up to 5 shipment photos.");
      return;
    }
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        `${camera ? "Camera" : "Photo library"} access is required.`,
      );
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.65,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          selectionLimit: Math.max(5 - form.photos.length, 1),
          quality: 0.65,
        });
    if (!result.canceled) {
      const nextUris = (result.assets || []).map((asset) => asset.uri).filter(Boolean);
      setForm((current) => ({
        ...current,
        photos: [...current.photos, ...nextUris].slice(0, 5),
      }));
    }
  };

  const uploadPhotos = async (shipmentId, photos) => {
    const urls = [];
    for (let index = 0; index < photos.length; index += 1) {
      const response = await fetch(photos[index]);
      const blob = await response.blob();
      const storageRef = ref(
        storage,
        `shipments/${shipmentId}/proof_of_receipt_${Date.now()}_${index + 1}.jpg`,
      );
      await uploadBytes(storageRef, blob);
      urls.push(await getDownloadURL(storageRef));
    }
    return urls;
  };

  const save = async () => {
    const invalidItem = form.items.some((item) => {
      const quantity = Number(item.quantity);
      return (
        !item.description.trim() ||
        !Number.isFinite(quantity) ||
        quantity < 1
      );
    });
    if (
      !form.sender.name.trim() ||
      !form.sender.phone.trim() ||
      !form.recipient.name.trim() ||
      !form.recipient.phone.trim() ||
      !form.origin.trim() ||
      !form.destination.trim() ||
      form.origin === form.destination ||
      (warehouseCode(form.destination) === "ODI" &&
        !form.municipality.trim()) ||
      invalidItem
    ) {
      Alert.alert(
        "Missing information",
        "Complete the route, sender, recipient, and all required package fields. Origin and destination must be different.",
      );
      return;
    }

    try {
      setSaving(true);
      const response = await createShipment({
        sender: {
          name: form.sender.name.trim(),
          phone: form.sender.phone.trim(),
          secondaryPhone: form.sender.secondaryPhone.trim() || null,
          email: form.sender.email.trim() || null,
          address: {
            unit: form.sender.unit.trim(),
            street: form.sender.street.trim(),
            barangay: form.sender.barangay.trim(),
            city: form.sender.city.trim() || form.origin.trim(),
            province: form.sender.province.trim() || "Philippines",
          },
        },
        recipient: {
          name: form.recipient.name.trim(),
          phone: form.recipient.phone.trim(),
          secondaryPhone: form.recipient.secondaryPhone.trim() || null,
          email: form.recipient.email.trim() || null,
          address: {
            unit: form.recipient.unit.trim(),
            street: form.recipient.street.trim(),
            barangay: form.recipient.barangay.trim(),
            city:
              form.municipality.trim() ||
              form.recipient.city.trim() ||
              form.destination.trim(),
            municipality: form.municipality.trim() || null,
            province: form.recipient.province.trim() || "Romblon",
          },
        },
        origin: form.origin.trim(),
        originCode: warehouseCode(form.origin),
        destination: form.destination.trim(),
        destinationCode: warehouseCode(form.destination),
        municipality: form.municipality.trim() || null,
        items: form.items.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          declaredValue: Number(item.declaredValue) || 0,
          packagingGroup: item.packagingGroup,
          packagingType: item.packagingType,
          isFragile: item.isFragile === true,
          isPerishable: item.isPerishable === true,
        })),
        remarks: form.remarks.trim(),
        status: form.mode === "pickup" ? "PENDING_PICKUP" : "RECEIVED",
        currentLocation:
          form.mode === "pickup"
            ? [form.sender.barangay, form.sender.city].filter(Boolean).join(" ")
            : form.origin.trim(),
        notifySms: false,
        notifyEmail: false,
        notifyPush: false,
      });
      const shipmentId = response?.data?.shipmentId;
      let photoWarning = "";
      if (shipmentId && form.photos.length) {
        try {
          const imageUrls = await uploadPhotos(shipmentId, form.photos);
          await updateShipmentImages({
            shipmentId,
            type: "receipt",
            images: imageUrls,
          });
        } catch (photoError) {
          photoWarning =
            "\n\nThe shipment was saved, but its photos could not be uploaded.";
        }
      }
      Alert.alert(
        "Shipment created",
        `${shipmentId || "The shipment was created successfully."}${photoWarning}`,
      );
      onClose();
      await onCreated?.();
    } catch (error) {
      Alert.alert("Shipment not created", error.message || "Please try again.");
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
                1. Shipment Details
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Fill in the package and routing info.
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
            style={styles.scroll}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.modeToggle,
                { backgroundColor: colors.cardMuted, borderColor: colors.border },
              ]}
            >
              {[
                ["dropoff", "home", "Warehouse Drop-off"],
                ["pickup", "truck", "Pickup"],
              ].map(([value, icon, label]) => {
                const active = form.mode === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setField("mode", value)}
                    style={[
                      styles.modeButton,
                      active && {
                        backgroundColor: value === "pickup" ? "#d97706" : "#2563eb",
                      },
                    ]}
                  >
                    <Feather
                      name={icon}
                      size={14}
                      color={active ? "#fff" : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.modeText,
                        { color: active ? "#fff" : colors.textMuted },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <FormCard
              icon="git-branch"
              title="Shipment Route"
              colors={colors}
            >
              <DropdownSelector
                label="Origin Warehouse *"
                value={form.origin}
                options={warehouseOptions}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    origin: value,
                    destination:
                      current.destination === value
                        ? warehouseOptions.find((option) => option !== value) || ""
                        : current.destination,
                  }))
                }
                colors={colors}
              />
              <DropdownSelector
                label="Destination Warehouse *"
                value={form.destination}
                options={warehouseOptions.filter((value) => value !== form.origin)}
                onChange={(value) => setField("destination", value)}
                colors={colors}
              />
            </FormCard>

            <FormCard icon="map-pin" title="Destination Municipality" colors={colors}>
              <DropdownSelector
                label="Municipality *"
                value={form.municipality}
                options={municipalities}
                onChange={(value) => {
                  setField("municipality", value);
                  setContact("recipient", "city", value);
                }}
                colors={colors}
              />
              <Text style={[styles.help, { color: colors.textMuted }]}>
                Checkers only see shipments for municipalities assigned to them.
              </Text>
            </FormCard>

            <ContactCard
              title="Sender Contact Details"
              contact={form.sender}
              onChange={(field, value) => setContact("sender", field, value)}
              colors={colors}
              accent="#2563eb"
            />
            <ContactCard
              title="Recipient Contact Details"
              contact={form.recipient}
              onChange={(field, value) => setContact("recipient", field, value)}
              colors={colors}
              accent="#059669"
            />

            <View style={styles.packageHeading}>
              <Section label="Package Items" colors={colors} />
              <Pressable
                onPress={addItem}
                style={[styles.addItem, { borderColor: colors.border }]}
              >
                <Feather name="plus" size={14} color="#2563eb" />
                <Text style={styles.addItemText}>Item</Text>
              </Pressable>
            </View>
            {form.items.map((item, index) => (
              <PackageItemCard
                key={`package-${index}`}
                item={item}
                index={index}
                canRemove={form.items.length > 1}
                onChange={(field, value) => setItem(index, field, value)}
                onRemove={() => removeItem(index)}
                colors={colors}
              />
            ))}

            <FormCard icon="camera" title="Shipment Photos" colors={colors}>
              <View style={styles.photoActions}>
                <Pressable
                  onPress={() => choosePhoto(false)}
                  style={[styles.photoButton, { borderColor: colors.border }]}
                >
                  <Feather name="image" size={18} color="#2563eb" />
                  <Text style={[styles.photoButtonText, { color: colors.text }]}>
                    Upload
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => choosePhoto(true)}
                  style={[styles.photoButton, { borderColor: colors.border }]}
                >
                  <Feather name="camera" size={18} color="#059669" />
                  <Text style={[styles.photoButtonText, { color: colors.text }]}>
                    Camera
                  </Text>
                </Pressable>
              </View>
              {form.photos.length ? (
                <View style={styles.photoList}>
                  {form.photos.map((uri, index) => (
                    <View
                      key={`${uri}-${index}`}
                      style={[styles.photoRow, { borderColor: colors.border }]}
                    >
                      <Feather name="check-circle" size={15} color="#059669" />
                      <Text
                        numberOfLines={1}
                        style={[styles.photoName, { color: colors.textMuted }]}
                      >
                        Photo {index + 1}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setForm((current) => ({
                            ...current,
                            photos: current.photos.filter(
                              (_, photoIndex) => photoIndex !== index,
                            ),
                          }))
                        }
                      >
                        <Feather name="trash-2" size={15} color="#dc2626" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.help, { color: colors.textMuted }]}>
                  Add up to 5 receipt photos from the camera or photo library.
                </Text>
              )}
            </FormCard>
            <Field label="Remarks" value={form.remarks} onChangeText={(value) => setField("remarks", value)} multiline colors={colors} />
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.button, { borderColor: colors.border }]}>
              <Text style={[styles.cancel, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={save} style={[styles.button, styles.primary]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create shipment</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ label, colors }) {
  return <Text style={[styles.section, { color: colors.text }]}>{label}</Text>;
}

function FormCard({ icon, title, colors, children }) {
  return (
    <View
      style={[
        styles.formCard,
        { backgroundColor: colors.cardMuted, borderColor: colors.border },
      ]}
    >
      <View style={styles.formCardTitle}>
        <Feather name={icon} size={15} color="#2563eb" />
        <Text style={[styles.formCardTitleText, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function DropdownSelector({ label, value, options, onChange, colors }) {
  const [open, setOpen] = useState(false);
  const normalizedOptions = options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : option,
  );
  const selectedLabel =
    normalizedOptions.find((option) => option.value === value)?.label || value;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.dropdownControl,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.dropdownValue, { color: colors.text }]}>
          {selectedLabel || "Select..."}
        </Text>
        <Feather
          name="chevron-down"
          size={17}
          color={colors.textMuted}
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.pickerSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>
                  {label.replace(/\s*\*$/, "")}
                </Text>
                <Text style={[styles.pickerSubtitle, { color: colors.textMuted }]}>
                  Select one option
                </Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                style={[styles.pickerClose, { backgroundColor: colors.cardMuted }]}
              >
                <Feather name="x" size={18} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.pickerOptions}
              contentContainerStyle={styles.pickerOptionsContent}
              nestedScrollEnabled
            >
              {normalizedOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={[
                styles.dropdownOption,
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
                  styles.dropdownOptionText,
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

function ContactCard({ title, contact, onChange, colors, accent }) {
  return (
    <View
      style={[
        styles.formCard,
        { backgroundColor: colors.cardMuted, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.contactTitle, { color: accent }]}>{title}</Text>
      <View style={styles.twoColumns}>
        <View style={styles.halfField}>
          <Field
            label="Contact name *"
            value={contact.name}
            onChangeText={(value) => onChange("name", value)}
            colors={colors}
          />
        </View>
        <View style={styles.halfField}>
          <Field
            label="Phone number *"
            value={contact.phone}
            onChangeText={(value) => onChange("phone", value)}
            keyboardType="phone-pad"
            colors={colors}
          />
        </View>
      </View>
      <Field
        label="Secondary phone"
        value={contact.secondaryPhone}
        onChangeText={(value) => onChange("secondaryPhone", value)}
        keyboardType="phone-pad"
        colors={colors}
      />
      <Field
        label="Email"
        value={contact.email}
        onChangeText={(value) => onChange("email", value)}
        keyboardType="email-address"
        autoCapitalize="none"
        colors={colors}
      />
      <View style={styles.twoColumns}>
        <View style={styles.shortField}>
          <Field
            label="Unit / House"
            value={contact.unit}
            onChangeText={(value) => onChange("unit", value)}
            colors={colors}
          />
        </View>
        <View style={styles.longField}>
          <Field
            label="Street name"
            value={contact.street}
            onChangeText={(value) => onChange("street", value)}
            colors={colors}
          />
        </View>
      </View>
      <View style={styles.twoColumns}>
        <View style={styles.halfField}>
          <Field
            label="Barangay"
            value={contact.barangay}
            onChangeText={(value) => onChange("barangay", value)}
            colors={colors}
          />
        </View>
        <View style={styles.halfField}>
          <Field
            label="Province"
            value={contact.province}
            onChangeText={(value) => onChange("province", value)}
            colors={colors}
          />
        </View>
      </View>
      <Field
        label="City / Municipality"
        value={contact.city}
        onChangeText={(value) => onChange("city", value)}
        colors={colors}
      />
    </View>
  );
}

function PackageItemCard({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
  colors,
}) {
  return (
    <View
      style={[
        styles.packageCard,
        { backgroundColor: colors.cardMuted, borderColor: colors.border },
      ]}
    >
      <View style={styles.packageCardHeader}>
        <View style={[styles.itemIndex, { backgroundColor: colors.surface }]}>
          <Text style={[styles.itemIndexText, { color: colors.textMuted }]}>
            {index + 1}
          </Text>
        </View>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeItem}>
            <Feather name="trash-2" size={16} color="#dc2626" />
          </Pressable>
        ) : null}
      </View>
      <Field
        label="Description *"
        value={item.description}
        onChangeText={(value) => onChange("description", value)}
        placeholder="e.g. Nike Shoes"
        colors={colors}
      />
      <View style={styles.twoColumns}>
        <View style={styles.halfField}>
          <DropdownSelector
            label="Type"
            value={item.packagingType}
            options={PACKAGING_TYPES}
            onChange={(value) => onChange("packagingType", value)}
            colors={colors}
          />
        </View>
        <View style={styles.halfField}>
          <Field
            label="Quantity *"
            value={item.quantity}
            onChangeText={(value) => onChange("quantity", value)}
            keyboardType="number-pad"
            colors={colors}
          />
        </View>
      </View>
      <View style={styles.twoColumns}>
        <View style={styles.halfField}>
          <Field
            label="Declared value"
            value={item.declaredValue}
            onChangeText={(value) => onChange("declaredValue", value)}
            keyboardType="decimal-pad"
            placeholder="0.00"
            colors={colors}
          />
        </View>
        <View style={styles.halfField}>
          <DropdownSelector
            label="Pack"
            value={item.packagingGroup}
            options={[
              { value: "SINGLE", label: "Single" },
              { value: "BULK", label: "Bulk / Pack" },
            ]}
            onChange={(value) => onChange("packagingGroup", value)}
            colors={colors}
          />
        </View>
      </View>
      <View style={styles.tags}>
        {[
          ["isFragile", "alert-triangle", "Fragile", "#d97706"],
          ["isPerishable", "thermometer", "Perishable", "#0891b2"],
        ].map(([field, icon, label, color]) => {
          const active = item[field] === true;
          return (
            <Pressable
              key={field}
              onPress={() => onChange(field, !active)}
              style={[
                styles.tag,
                {
                  borderColor: active ? color : colors.border,
                  backgroundColor: active ? `${color}18` : colors.surface,
                },
              ]}
            >
              <Feather name={icon} size={14} color={active ? color : colors.textMuted} />
              <Text
                style={[
                  styles.tagText,
                  { color: active ? color : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({ label, colors, multiline = false, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border },
        ]}
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
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 0 },
  form: { paddingHorizontal: 18, paddingBottom: 18, gap: 11 },
  section: { fontSize: 15, fontWeight: "900", marginTop: 5 },
  modeToggle: { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  modeButton: { flex: 1, minHeight: 43, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  modeText: { fontSize: 10, fontWeight: "900" },
  formCard: { borderWidth: 1, borderRadius: 15, padding: 13, gap: 11 },
  formCardTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  formCardTitleText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
  contactTitle: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  help: { fontSize: 9, lineHeight: 14 },
  dropdownControl: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  dropdownValue: { flex: 1, fontSize: 13, fontWeight: "700" },
  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.58)" },
  pickerSheet: { maxHeight: "72%", borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  pickerHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  pickerHeaderCopy: { flex: 1 },
  pickerTitle: { fontSize: 17, fontWeight: "900" },
  pickerSubtitle: { fontSize: 10, marginTop: 2 },
  pickerClose: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pickerOptions: { flexGrow: 0 },
  pickerOptionsContent: { gap: 7, paddingBottom: 4 },
  dropdownOption: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dropdownOptionText: { fontSize: 12, fontWeight: "700" },
  twoColumns: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  halfField: { flex: 1, minWidth: 0 },
  shortField: { flex: 0.7, minWidth: 0 },
  longField: { flex: 1.3, minWidth: 0 },
  packageHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  addItem: { minHeight: 36, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  addItemText: { color: "#2563eb", fontSize: 10, fontWeight: "900" },
  packageCard: { borderWidth: 1, borderRadius: 15, padding: 13, gap: 11 },
  packageCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemIndex: { width: 31, height: 31, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  itemIndexText: { fontSize: 11, fontWeight: "900" },
  removeItem: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tags: { flexDirection: "row", gap: 8 },
  tag: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  tagText: { fontSize: 10, fontWeight: "800" },
  photoActions: { flexDirection: "row", gap: 9 },
  photoButton: { flex: 1, minHeight: 62, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 5 },
  photoButtonText: { fontSize: 10, fontWeight: "900" },
  photoList: { gap: 6 },
  photoRow: { minHeight: 38, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  photoName: { flex: 1, fontSize: 10 },
  field: { gap: 5 },
  label: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  input: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 14 },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 10, fontWeight: "800" },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, padding: 16 },
  button: { flex: 1, minHeight: 49, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  cancel: { fontWeight: "800" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
