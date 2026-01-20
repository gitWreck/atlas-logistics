import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import AtlasButton from "../../components/ui/AtlasButton";
// You'll likely use a "Picker" or "Dropdown" library here

const DELAY_TYPES = [
  { label: "🚢 Port Congestion", value: "PORT" },
  { label: "⛴️ RORO Schedule", value: "RORO" },
  { label: "🚗 Heavy Traffic", value: "TRAFFIC" },
  { label: "🔧 Mechanical Issue", value: "MECHANICAL" },
];

export default function ReportDelayScreen() {
  const [selectedReason, setSelectedReason] = useState(null);

  const handleSubmit = async () => {
    if (!selectedReason) return Alert.alert("Error", "Select a reason");

    // 1. Call your Shared Logic (from packages/shared)
    // await reportDelay(shipmentId, selectedReason);

    // 2. Show the "Pending Approval" warning
    Alert.alert(
      "Delay Reported",
      "This delay is effectively PENDING until a Manager approves it.",
    );
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>
        Why is the shipment delayed?
      </Text>

      {/* Simple Custom Selector for your specific types */}
      {DELAY_TYPES.map((type) => (
        <AtlasButton
          key={type.value}
          title={type.label}
          // Highlight the selected one
          style={
            selectedReason === type.value ? { backgroundColor: "red" } : {}
          }
          onPress={() => setSelectedReason(type.value)}
        />
      ))}

      <View style={{ marginTop: 40 }}>
        <AtlasButton title="Submit Report" onPress={handleSubmit} />
      </View>
    </View>
  );
}
