import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as Location from "expo-location";

import { useTheme } from "../../../contexts/ThemeContext";

let NativeMapView = null;
let NativeMarker = null;
let NativePolyline = null;
let GoogleProvider = null;

if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  NativeMapView = Maps.default;
  NativeMarker = Maps.Marker;
  NativePolyline = Maps.Polyline;
  GoogleProvider = Maps.PROVIDER_GOOGLE;
}

const EDGE_PADDING = { top: 35, right: 35, bottom: 35, left: 35 };
const WEB_MAP_URL = "https://maps.google.com/maps?saddr=14.600025,120.969801&daddr=12.4106667,121.9907778&output=embed";

const createDarkMapStyle = (colors) => [
  { elementType: "geometry", stylers: [{ color: colors.cardMuted }] },
  { elementType: "labels.text.fill", stylers: [{ color: colors.iconMuted }] },
  { elementType: "labels.text.stroke", stylers: [{ color: colors.bg }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: colors.border }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: colors.dashboardSurfaceMuted }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: colors.border }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: colors.bg }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: colors.textMuted }] },
];

export default function BranchMap({ branches, selectedId, onSelect, onOpenFullMap }) {
  const mapRef = useRef(null);
  const { colors, resolvedScheme } = useTheme();
  const [locating, setLocating] = useState(false);
  const [webMapUrl, setWebMapUrl] = useState(WEB_MAP_URL);

  const locateUser = async () => {
    if (locating) return;
    try {
      setLocating(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission needed", "Allow location access to center the map on your current position.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = current.coords;

      if (Platform.OS === "web") {
        setWebMapUrl(`https://maps.google.com/maps?q=${latitude},${longitude}&z=14&output=embed`);
        return;
      }

      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 },
        650,
      );
    } catch (error) {
      Alert.alert("Location unavailable", "We couldn't get your current location. Please try again.");
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current || branches.length === 0) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        branches.map((branch) => branch.coordinate),
        { edgePadding: EDGE_PADDING, animated: false },
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [branches]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
        {React.createElement("iframe", {
          src: webMapUrl,
          title: "Atlas branch locations Google Map",
          loading: "lazy",
          referrerPolicy: "no-referrer-when-downgrade",
          style: styles.webMap,
        })}
        {branches.map((branch) => {
          const isDivisoria = branch.id === "divisoria";
          return (
            <TouchableOpacity
              key={branch.id}
              onPress={() => onSelect(branch.id)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Select ${branch.name}`}
              style={[styles.webMarker, isDivisoria ? styles.webMarkerDivisoria : styles.webMarkerOdiongan]}
            >
              <View style={[styles.webMarkerPin, { backgroundColor: selectedId === branch.id ? colors.primary : colors.primaryDeep }]}>
                <Feather name="map-pin" size={15} color={colors.onPrimary} />
              </View>
              <View style={[styles.webMarkerLabel, { backgroundColor: colors.dashboardSurface }] }>
                <Text style={[styles.webMarkerTitle, { color: colors.text }]}>{branch.name}</Text>
                <Text style={[styles.webMarkerLocation, { color: colors.textMuted }]}>{branch.location}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={locateUser}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="View branches in Google Maps"
          style={[styles.fullMapButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
        >
          <Text style={[styles.fullMapText, { color: colors.text }]}>View Full Map</Text>
          <Feather name="external-link" size={14} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenFullMap}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Center map on my current location"
          style={[styles.locationButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="crosshair" size={22} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (!NativeMapView || !NativeMarker) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
        <Feather name="map" size={42} color={colors.primary} />
        <Text style={[styles.fallbackTitle, { color: colors.text }]}>Branch map</Text>
        <Text style={[styles.fallbackText, { color: colors.textMuted }]}>Open Google Maps to view both Atlas branches.</Text>
        <TouchableOpacity onPress={onOpenFullMap} style={[styles.fallbackButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.fallbackButtonText, { color: colors.onPrimary }]}>Open Google Maps</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
      <NativeMapView
        ref={mapRef}
        provider={GoogleProvider}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 13.5, longitude: 121.45, latitudeDelta: 4.5, longitudeDelta: 3.2 }}
        customMapStyle={resolvedScheme === "dark" ? createDarkMapStyle(colors) : []}
        onMapReady={() => mapRef.current?.fitToCoordinates(
          branches.map((branch) => branch.coordinate),
          { edgePadding: EDGE_PADDING, animated: false },
        )}
        toolbarEnabled={false}
        showsUserLocation
      >
        {NativePolyline ? (
          <NativePolyline
            coordinates={branches.map((branch) => branch.coordinate)}
            strokeColor={resolvedScheme === "dark" ? colors.text : colors.primary}
            strokeWidth={2}
            lineDashPattern={[7, 7]}
            geodesic
          />
        ) : null}
        {branches.map((branch) => (
          <NativeMarker
            key={branch.id}
            coordinate={branch.coordinate}
            onPress={() => onSelect(branch.id)}
          >
            <View style={styles.markerWrap}>
              <View style={[styles.markerPin, { backgroundColor: selectedId === branch.id ? colors.primary : colors.primaryDeep }] }>
                <Feather name="map-pin" size={18} color={colors.onPrimary} />
              </View>
              <View>
                <Text style={[styles.markerTitle, { color: colors.onPrimary }]}>{branch.name}</Text>
                <Text style={[styles.markerLocation, { color: colors.iconMuted }]}>{branch.location}</Text>
              </View>
            </View>
          </NativeMarker>
        ))}
      </NativeMapView>
      <TouchableOpacity
        onPress={onOpenFullMap}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View branches in Google Maps"
        style={[styles.fullMapButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
      >
        <Text style={[styles.fullMapText, { color: colors.text }]}>View Full Map</Text>
        <Feather name="external-link" size={14} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={locateUser}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Center map on my current location"
        style={[styles.locationButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather name="crosshair" size={22} color={colors.text} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 340, borderRadius: 20, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 3 },
  fullMapButton: { position: "absolute", top: 16, right: 16, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  fullMapText: { fontSize: 13, fontWeight: "800" },
  locationButton: { position: "absolute", right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  markerWrap: { maxWidth: 170, flexDirection: "row", alignItems: "center", gap: 8 },
  markerPin: { width: 38, height: 46, borderRadius: 19, borderBottomLeftRadius: 5, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  markerTitle: { fontSize: 12, lineHeight: 16, fontWeight: "900", textShadowRadius: 3 },
  markerLocation: { marginTop: 2, fontSize: 9, textShadowRadius: 3 },
  webMap: { position: "absolute", inset: 0, width: "100%", height: "100%", borderWidth: 0 },
  webMarker: { position: "absolute", flexDirection: "row", alignItems: "center" },
  webMarkerDivisoria: { left: "17%", top: "18%" },
  webMarkerOdiongan: { right: "12%", bottom: "23%" },
  webMarkerPin: { width: 34, height: 42, borderRadius: 17, borderBottomLeftRadius: 5, alignItems: "center", justifyContent: "center" },
  webMarkerLabel: { maxWidth: 145, marginLeft: 6, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6 },
  webMarkerTitle: { fontSize: 10, lineHeight: 13, fontWeight: "900" },
  webMarkerLocation: { marginTop: 2, fontSize: 8 },
  fallback: { height: 340, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  fallbackTitle: { marginTop: 12, fontSize: 17, fontWeight: "800" },
  fallbackText: { marginTop: 6, fontSize: 12, lineHeight: 18, textAlign: "center" },
  fallbackButton: { marginTop: 17, height: 42, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  fallbackButtonText: { fontSize: 13, fontWeight: "800" },
});
