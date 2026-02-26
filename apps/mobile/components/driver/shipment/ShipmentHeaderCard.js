import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme"; // Adjust path
import StatusBadge from "../../ui/StatusBadge"; // Reuse your badge
import * as Clipboard from "expo-clipboard"; // ✅ Add this

const ShipmentHeaderCard = ({ shipment }) => {
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

  return (
    <View style={styles.card}>
      {/* Top Row: ID & Status */}
      <View style={styles.header}>
        <Text style={styles.idText}>{shipment.id || "ID: --"}</Text>
        <StatusBadge status={shipment.status} />
      </View>

      {/* Destination (Big) */}
      <View style={styles.section}>
        <View style={styles.row}>
          <FontAwesome5
            name="map-marker-alt"
            size={20}
            color={COLORS.danger}
            style={{ width: 24 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressText}>{streetText}</Text>

            <Text style={styles.subText}>{cityProvinceText}</Text>
          </View>
        </View>
      </View>

      {/* Receiver Info */}
      <View style={[styles.section, { borderBottomWidth: 0 }]}>
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
              <Text style={styles.label}>Receiver</Text>
              <Text style={styles.valueText} numberOfLines={1}>
                {receiverName}
              </Text>
            </View>
          </View>

          {/* --- RIGHT SIDE: Phone & Copy Button --- */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.phoneText, { marginRight: 8, marginTop: 0 }]}>
              {receiverPhone}
            </Text>

            {/* Only show the copy button if there is an actual phone number */}
            {receiverPhone !== "No Phone" && (
              <TouchableOpacity
                onPress={copyPhoneToClipboard}
                style={{
                  padding: 6,
                  backgroundColor: "#f1f5f9",
                  borderRadius: 8,
                }}
              >
                <FontAwesome5 name="copy" size={14} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>
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
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: SEPARATOR,
  },
  idText: {
    color: LABEL_GREY,
    fontWeight: "bold",
    fontSize: 14,
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
  phoneText: { color: COLORS.primary, fontSize: 14, marginTop: 2 },
});
