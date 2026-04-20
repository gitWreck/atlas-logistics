import React from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { COLORS } from "../constants/templates";

export default function TrackingMap({
  mapRef,
  initialRegion,
  historyLocations,
  packageLocation,
}) {
  return (
    <View style={styles.mapSectionCard}>
      <Text style={styles.sectionTitle}>Package Location</Text>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          scrollEnabled={true}
          zoomEnabled={true}
          provider={PROVIDER_DEFAULT}
        >
          {historyLocations.length > 0 ? (
            historyLocations.map((coord, index) => {
              const isLatest = index === historyLocations.length - 1;
              return (
                <Marker
                  key={`history-${index}`}
                  coordinate={coord}
                  pinColor={isLatest ? COLORS.BLUE : COLORS.GREY}
                  title={isLatest ? "Latest package location" : "Previous stop"}
                  description={isLatest ? "Most recent scan" : "Earlier scan"}
                />
              );
            })
          ) : (
            <Marker
              coordinate={packageLocation}
              title="Your package"
              description="Current package location"
            />
          )}
        </MapView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapSectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { color: "#0f172a", fontSize: 13, fontWeight: "600" },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  map: { width: "100%", height: "100%" },
});
