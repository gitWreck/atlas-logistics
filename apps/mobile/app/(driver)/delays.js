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
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebase";

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

  // 1. Auto-fetch the active trip (so the driver doesn't have to select it)
  useEffect(() => {
    const fetchActiveTrip = async () => {
      try {
        const q = query(
          collection(db, "truck_trips"),
          where("status", "in", ["LOADED", "IN_TRANSIT"]),
          // where("driverId", "==", auth.currentUser.uid), // Uncomment in production
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
      // 2. Save to 'trip_delays' sub-collection (or a global 'alerts' collection)
      await addDoc(collection(db, "truck_trips", tripId, "delays"), {
        type: selectedType,
        notes: notes,
        reportedAt: serverTimestamp(),
        status: "PENDING_APPROVAL", // Per your rule: Manager must approve
        driverId: auth.currentUser?.uid || "unknown",
      });

      Alert.alert("Reported", "Delay has been reported to the dashboard.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Report Delay</Text>
        <Text style={styles.subtitle}>Select the reason for the delay</Text>

        <View style={styles.grid}>
          {DELAY_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.card,
                selectedType === type.id && {
                  borderColor: type.color,
                  backgroundColor: `${type.color}20`,
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
          placeholderTextColor="#64748b"
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>SUBMIT REPORT</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  content: { padding: 24, paddingBottom: 50 },

  title: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#94a3b8", marginBottom: 32 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  card: {
    width: "48%",
    backgroundColor: "#1e293b",
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
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },

  label: { color: "#cbd5e1", marginBottom: 8, fontWeight: "600" },
  input: {
    backgroundColor: "#1e293b",
    color: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: 32,
  },

  submitBtn: {
    backgroundColor: "#fbbf24",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "bold", fontSize: 16 },
});
