import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

export default function LoginHeader({ title, subtitle }) {
  return (
    <View style={styles.header}>
      <Image source={require("../../assets/atlas-login.svg")} style={{ width: 200, height: 200 }} />
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#2563eb", // blue-600
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 10,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0650A0",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: "#94a3b8", // slate-400
    fontSize: 14,
    marginTop: 8,
  },
});
