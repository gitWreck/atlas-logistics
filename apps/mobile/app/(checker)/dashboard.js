import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AtlasButton from "../../components/ui/AtlasButton"; // Reusing your button

export default function CheckerDashboard() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checker Mode</Text>

      {/* 📦 THE BIG BUTTON */}
      <View style={styles.centerAction}>
        <AtlasButton
          title="SCAN PACKAGE"
          iconName="qrcode"
          onPress={() => router.push("/(checker)/scan")}
        />
        <Text style={styles.hint}>
          Scan to mark Out for Delivery or Delivered
        </Text>
      </View>
    </View>
  );
}
// ... styles ...
