import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router"; // ✅ Import this

export default function GridButton({ title, icon, color, mode }) {
  const router = useRouter(); // ✅ Initialize hook here

  return (
    // ✅ Added 'return' keyword
    <TouchableOpacity
      style={[styles.card, { backgroundColor: color }]}
      activeOpacity={0.8}
      onPress={() =>
        router.push({
          pathname: "/(checker)/scan",
          params: { mode: mode },
        })
      }
    >
      <View style={styles.iconCircle}>
        <FontAwesome name={icon} size={32} color={color} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

// ✅ Move the styles INSIDE this component so it is self-contained.
// You don't want to pass 'styles' from the parent (it's messy).
const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: "space-between",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white", // The white circle behind the icon
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
