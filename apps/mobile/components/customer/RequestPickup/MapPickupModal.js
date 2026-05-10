import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";

const DEFAULT_LOCATION = { lat: 14.5995, lng: 120.9842 };

export default function MapPickupModal({
  visible,
  initialLocation,
  onClose,
  onConfirm,
}) {
  const { colors } = useTheme();
  // Default to Manila if no initial location is provided
  const [tempLoc, setTempLoc] = useState(initialLocation || DEFAULT_LOCATION);

  // Sync temp location if the user opens the modal again after already picking a spot
  useEffect(() => {
    if (visible && initialLocation) {
      setTempLoc(initialLocation);
    }
  }, [visible, initialLocation]);

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

        {/* Full Screen Map */}
        <MapView
          provider={PROVIDER_DEFAULT}
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
          <Marker
            coordinate={{ latitude: tempLoc.lat, longitude: tempLoc.lng }}
            pinColor="#2563eb"
            title="Pickup Here"
          />
        </MapView>

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
            onPress={() => {
              onConfirm(tempLoc);
              onClose();
            }}
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
