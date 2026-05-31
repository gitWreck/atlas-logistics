import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

function formatTimestamp(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDisplayValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object") {
    const lat = value.lat ?? value.latitude;
    const lng = value.lng ?? value.longitude;
    if (lat != null && lng != null) {
      return `${lat}, ${lng}`;
    }
    return null;
  }
  return String(value);
}

function DetailLine({ icon, label, value }) {
  const displayValue = formatDisplayValue(value);
  if (!displayValue) return null;
  return (
    <View style={styles.detailLine}>
      <FontAwesome5 name={icon} size={10} color="#64748b" />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {displayValue}
      </Text>
    </View>
  );
}

function TimelineEventCard({ event, isLast, colors, isDark }) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            { backgroundColor: isDark ? "#07B9F4" : "#042C83" },
          ]}
        />
        {!isLast && (
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        )}
      </View>

      <View
        style={[
          styles.eventCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.eventHeader}>
          <Text style={[styles.eventTitle, { color: colors.text }]}>
            {event.title}
          </Text>
          <Text style={[styles.eventTime, { color: colors.textMuted }]}>
            {formatTimestamp(event.timestamp)}
          </Text>
        </View>

        {!!event.actorName && (
          <DetailLine icon="user" label="By" value={event.actorName} />
        )}
        <DetailLine
          icon="map-marker-alt"
          label="Location"
          value={event.location}
        />
        <DetailLine icon="route" label="Trip" value={event.tripId} />
        <DetailLine
          icon="truck"
          label="Truck"
          value={
            event.truckName
              ? `${event.truckName}${event.truckPlate ? ` (${event.truckPlate})` : ""}`
              : event.truckPlate
          }
        />
        <DetailLine icon="id-badge" label="Driver" value={event.driverName} />
        <DetailLine
          icon="user-check"
          label="Checker"
          value={event.checkerName}
        />
        <DetailLine
          icon="warehouse"
          label="Manager"
          value={event.warehouseManagerName}
        />
        <DetailLine
          icon="shipping-fast"
          label="Vehicle"
          value={event.deliveryVehicleName || event.deliveryVehicleId}
        />
        <DetailLine icon="sticky-note" label="Note" value={event.remarks} />

        {!!event.proofPhotoUrl && (
          <Image
            source={{ uri: event.proofPhotoUrl }}
            style={styles.proofImage}
            resizeMode="cover"
          />
        )}
      </View>
    </View>
  );
}

export default function CustodyTimeline({
  events = [],
  loading = false,
  error = null,
  colors,
  isDark = false,
  compact = false,
  emptyMessage = "No custody events recorded yet.",
}) {
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={isDark ? "#07B9F4" : "#042C83"} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading custody timeline...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <Text style={[styles.errorText, { color: "#ef4444" }]}>
        Could not load custody timeline.
      </Text>
    );
  }

  if (!events.length) {
    return (
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {emptyMessage}
      </Text>
    );
  }

  const content = events.map((event, index) => (
    <TimelineEventCard
      key={event.eventId || `${event.eventType}-${index}`}
      event={event}
      isLast={index === events.length - 1}
      colors={colors}
      isDark={isDark}
    />
  ));

  if (compact) {
    return <View style={styles.compactList}>{content}</View>;
  }

  return <View style={styles.list}>{content}</View>;
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  compactList: {
    gap: 0,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
  },
  eventRow: {
    flexDirection: "row",
    gap: 12,
  },
  rail: {
    width: 16,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
    marginBottom: -4,
  },
  eventCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  eventHeader: {
    marginBottom: 8,
    gap: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  eventTime: {
    fontSize: 11,
    fontWeight: "600",
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  detailLabel: {
    width: 56,
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  detailValue: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: "#334155",
  },
  proofImage: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginTop: 10,
  },
});
