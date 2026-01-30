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
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, auth } from "../../firebase";

// 🎨 IMPORT SHARED THEME
import { COLORS, GLOBAL_STYLES } from "../../components/constants/theme";
import { reportTripDelay } from "../../components/utilities/FirebaseFunctions";

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
  const router = useRouter();
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
      <View style={GLOBAL_STYLES.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={GLOBAL_STYLES.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={GLOBAL_STYLES.sectionTitle}>Report Delay</Text>
        <Text style={styles.subtitle}>Select the reason for the delay</Text>

        <View style={styles.grid}>
          {DELAY_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.card,
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
              <Text style={styles.cardLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Flat tire at KM 45..."
          placeholderTextColor={COLORS.textSecondary}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>SUBMIT REPORT</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  content: { padding: 24, paddingBottom: 50 },

  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
    marginTop: -8,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  card: {
    width: "48%",
    backgroundColor: COLORS.card,
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
    color: COLORS.textPrimary,
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },

  label: {
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.slate,
  },

  submitBtn: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
