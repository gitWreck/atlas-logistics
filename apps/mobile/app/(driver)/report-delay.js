import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { reportTripDelay } from "../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import GradientButton from "../../components/ui/figma/GradientButton";

const DELAY_TYPES = [
  {
    id: "TRAFFIC",
    label: "Heavy Traffic",
    icon: "traffic-light",
    color: "#f59e0b",
  },
  {
    id: "PORT_CONGESTION",
    label: "Port Congestion",
    icon: "anchor",
    color: "#3b82f6",
  },
  { id: "RORO_QUEUE", label: "RORO Queue", icon: "ship", color: "#06b6d4" },
  {
    id: "MECHANICAL",
    label: "Mechanical Issue",
    icon: "tools",
    color: "#ef4444",
  },
  { id: "OTHER", label: "Other", icon: "question", color: "#64748b" },
];

export default function ReportDelayScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const [tripId, setTripId] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(true);

  // 1. Auto-fetch active trip
  useEffect(() => {
    const fetchActiveTrip = async () => {
      try {
        const q = query(
          collection(db, "truck_trips"),
          where("status", "in", ["LOADED", "IN_TRANSIT"]),
          where("driverId", "==", auth.currentUser?.uid),
          limit(1),
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          setTripId(snapshot.docs[0].id);
        } else {
          Alert.alert(
            "No Active Trip",
            "You must have an active trip to report a delay.",
          );
          router.back();
        }
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Could not fetch active trip.");
      } finally {
        setFetching(false);
      }
    };
    fetchActiveTrip();
  }, []);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert("Missing Info", "Please select a delay type.");
      return;
    }
    setSubmitting(true);

    try {
      // 🚀 CALL CLOUD FUNCTION

      await reportTripDelay({
        tripId: tripId,
        type: selectedType,
        notes: notes,
        updatedBy: updatedBy(profile),
      });

      Alert.alert("Reported", "Dispatch has been notified immediately.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Delay Report Error:", error);
      Alert.alert("Error", error.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header: back | title - aligned with Trip Details */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Image
              source={require("../../assets/icons/back.svg")}
              style={{ width: 20, height: 20 }}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Report Delay
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Report Delay
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Select the reason for the delay
          </Text>

          <View style={styles.grid}>
            {DELAY_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  selectedType === type.id && {
                    borderColor: type.color,
                    backgroundColor: `${type.color}20`, // 20% opacity
                  },
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <View style={[styles.iconBox, { backgroundColor: type.color }]}>
                  <FontAwesome5 name={type.icon} size={20} color="#fff" />
                </View>
                <Text style={[styles.cardLabel, { color: colors.text }]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>
            Additional Notes (Optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="e.g., Flat tire at KM 45..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA: GradientButton */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <GradientButton
          title={submitting ? "Submitting..." : "Submit Report"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 0,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },

  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 24,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  card: {
    width: "48%",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardLabel: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },

  label: {
    color: "#64748b",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#ffffff",
    color: "#0f172a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});
