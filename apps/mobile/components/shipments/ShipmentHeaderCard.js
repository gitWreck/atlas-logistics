import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  Linking, // ✅ ADD THIS
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../constants/theme"; // Adjust path
import StatusBadge from "../ui/figma/StatusBadge"; // Reuse your badge
import * as Clipboard from "expo-clipboard"; // ✅ Add this
import { useTheme } from "../../contexts/ThemeContext";

const ShipmentHeaderCard = ({
  shipment,
  showActions = true,
  showCustomerCall = true,
  hidePhone = false,
}) => {
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";

  // Safely extract the address object to avoid crashes
  const address = shipment?.recipient?.address;

  // 1. Street Fallback Logic
  const streetText = address?.street
    ? address.street
    : address?.barangay
      ? `Street no., ${address.barangay}`
      : shipment?.destination || "No Address";

  // 2. City & Province Fallback Logic
  // This array filters out empty values so you don't get weird commas like ", Laguna" or "Lucban, "
  const cityProvinceText =
    [address?.city, address?.province].filter(Boolean).join(", ") ||
    "City/Province Not Specified";

  // Safely extract the recipient object
  const recipient = shipment?.recipient;

  // Fallback Logic
  const receiverName = recipient?.name || "N/A";
  const receiverPhone = recipient?.phone || "No Phone";

  const copyPhoneToClipboard = async () => {
    if (receiverPhone && receiverPhone !== "No Phone") {
      await Clipboard.setStringAsync(receiverPhone);
      Alert.alert("Copied!", "Phone number copied to clipboard.");
    }
  };

  // --- NEW: QUICK ACTIONS ---
  const callCustomer = async () => {
    if (!receiverPhone || receiverPhone === "No Phone") return;
    const url = `tel:${receiverPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Phone dialer is not available on this device.");
      }
    } catch (err) {
      console.error("Dialer error:", err);
    }
  };

  const openMaps = async () => {
    // Combine street and city for the most accurate map search
    const fullAddress = `${streetText}, ${cityProvinceText}`;
    const encodedAddress = encodeURIComponent(fullAddress);

    // This creates a universal Google Maps search URL that works on both iOS and Android
    const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open maps on this device.");
      }
    } catch (err) {
      console.error("Maps error:", err);
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Top Row: ID & Status */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text
          style={[styles.idText, { color: colors.textMuted }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {shipment.id || "ID: --"}
        </Text>
        <View style={styles.statusWrap}>
          <StatusBadge status={shipment.status} />
        </View>
      </View>

      {/* Destination (Big) */}
      <View style={[styles.section, { borderBottomColor: colors.border }]}>
        <View style={[styles.row, { alignItems: "center" }]}>
          <FontAwesome5
            name="map-marker-alt"
            size={20}
            color={COLORS.danger}
            style={{ width: 24 }}
          />
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.addressText, { color: colors.text }]}>
              {streetText}
            </Text>
            <Text style={[styles.subText, { color: colors.textMuted }]}>
              {cityProvinceText}
            </Text>
          </View>

          {/* ✅ NEW: Navigate Button */}
          {showActions && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: isDark ? "#164e63" : "#e0f2fe" },
              ]}
              onPress={openMaps}
            >
              <FontAwesome5 name="directions" size={16} color="#0284c7" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Receiver Info */}
      <View
        style={[
          styles.section,
          { borderBottomWidth: 0, borderBottomColor: colors.border },
        ]}
      >
        {/* We add justifyContent: 'space-between' to push items to opposite ends */}
        <View
          style={[
            styles.row,
            { justifyContent: "space-between", alignItems: "center" },
          ]}
        >
          {/* --- LEFT SIDE: Icon & Name --- */}
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <FontAwesome5
              name="user-check"
              size={16}
              color={COLORS.primary}
              style={{ width: 24 }}
            />
            <View>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                Receiver
              </Text>
              <Text
                style={[styles.valueText, { color: colors.text }]}
                numberOfLines={1}
              >
                {receiverName}
              </Text>
              {!hidePhone && (
                <Text
                  style={[
                    styles.phoneText,
                    {
                      color: colors.textMuted,
                      marginRight: 12,
                      marginTop: 2,
                    },
                  ]}
                >
                  {receiverPhone}
                </Text>
              )}
            </View>
          </View>

          {/* --- RIGHT SIDE: Phone & Quick Actions --- */}
          {showActions && showCustomerCall && !hidePhone && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
            {receiverPhone !== "No Phone" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {/* ✅ NEW: Call Button */}
                <TouchableOpacity
                  onPress={callCustomer}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isDark ? "#14532d" : "#dcfce7" },
                  ]}
                >
                  <FontAwesome5 name="phone-alt" size={14} color="#16a34a" />
                </TouchableOpacity>

                {/* Existing Copy Button */}
                <TouchableOpacity
                  onPress={copyPhoneToClipboard}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: colors.cardMuted },
                  ]}
                >
                  <FontAwesome5 name="copy" size={14} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default ShipmentHeaderCard;

const LABEL_GREY = "#6b7280";
const VALUE_DARK = "#111827";
const SEPARATOR = "#e5e7eb";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    paddingTop: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: SEPARATOR,
  },
  idText: {
    flex: 1,
    flexShrink: 1,
    color: LABEL_GREY,
    fontWeight: "bold",
    fontSize: 14,
  },
  statusWrap: {
    flexShrink: 1,
    maxWidth: "52%",
    alignItems: "flex-end",
  },
  section: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: SEPARATOR,
    paddingBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  addressText: {
    color: VALUE_DARK,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  subText: { color: LABEL_GREY, marginTop: 4 },
  label: { color: LABEL_GREY, fontSize: 12, marginBottom: 2 },
  valueText: { color: VALUE_DARK, fontSize: 16, fontWeight: "600" },
  phoneText: { color: "#333", fontSize: 14, marginTop: 2 },
  // --- NEW QUICK ACTION BUTTON STYLE ---
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
});
