import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Platform,
} from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useTheme } from "../../../contexts/ThemeContext";

const DEFAULT_LOCATION = { lat: 14.5995, lng: 120.9842 };

let NativeMapView = null;
let NativeMarker = null;
let nativeMapProvider = null;

if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  NativeMapView = Maps.default;
  NativeMarker = Maps.Marker;
  nativeMapProvider = Maps.PROVIDER_DEFAULT;
}

export default function MapPickupModal({
  visible,
  initialLocation,
  onClose,
  onConfirm,
}) {
  const { colors } = useTheme();
  // Default to Manila if no initial location is provided
  const [tempLoc, setTempLoc] = useState(initialLocation || DEFAULT_LOCATION);
  const [latText, setLatText] = useState(String(initialLocation?.lat || DEFAULT_LOCATION.lat));
  const [lngText, setLngText] = useState(String(initialLocation?.lng || DEFAULT_LOCATION.lng));

  // Sync temp location if the user opens the modal again after already picking a spot
  useEffect(() => {
    if (visible && initialLocation) {
      setTempLoc(initialLocation);
      setLatText(String(initialLocation.lat));
      setLngText(String(initialLocation.lng));
    }
  }, [visible, initialLocation]);

  const confirmLocation = () => {
    if (Platform.OS === "web") {
      const lat = Number(latText);
      const lng = Number(lngText);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        onConfirm({ lat, lng });
      } else {
        onConfirm(tempLoc);
      }
    } else {
      onConfirm(tempLoc);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <FontAwesome5 name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Pin Pickup Location
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {Platform.OS === "web" ? (
          <View style={[styles.webMapFallback, { backgroundColor: colors.cardMuted }]}>
            <View
              style={[
                styles.webPinIcon,
                { backgroundColor: colors.primarySoft, borderColor: colors.border },
              ]}
            >
              <FontAwesome5 name="map-marker-alt" size={22} color="#2563eb" />
            </View>
            <Text style={[styles.webTitle, { color: colors.text }]}>
              Enter pickup coordinates
            </Text>
            <Text style={[styles.webSubtitle, { color: colors.textMuted }]}>
              Maps are available on mobile. On web, type the latitude and longitude.
            </Text>
            <View style={styles.webInputRow}>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={latText}
                onChangeText={setLatText}
                keyboardType="numeric"
                placeholder="Latitude"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={lngText}
                onChangeText={setLngText}
                keyboardType="numeric"
                placeholder="Longitude"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        ) : (
          <NativeMapView
            provider={nativeMapProvider}
            style={styles.map}
            initialRegion={{
              latitude: tempLoc.lat,
              longitude: tempLoc.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onPress={(e) => {
              setTempLoc({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              });
            }}
          >
            <NativeMarker
              coordinate={{ latitude: tempLoc.lat, longitude: tempLoc.lng }}
              pinColor="#2563eb"
              title="Pickup Here"
            />
          </NativeMapView>
        )}

        {/* Footer Action */}
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <View style={styles.infoBox}>
            <FontAwesome5 name="info-circle" size={14} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Tap anywhere on the map to move the pin.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={confirmLocation}
          >
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  closeBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  map: { flex: 1 },
  webMapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  webPinIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  webTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  webSubtitle: {
    maxWidth: 360,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  webInputRow: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    gap: 10,
  },
  webInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  footer: {
    padding: 24,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  infoText: { marginLeft: 8, fontSize: 13, color: "#64748b" },
  confirmBtn: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
