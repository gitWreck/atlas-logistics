// components/checker/OperationsGrid.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../contexts/ThemeContext";

const LOAD_GRADIENT_COLORS = ["#042C83", "#07B9F4"];
const OFFLOAD_GRADIENT_COLORS = ["#042C83", "#10b981"];
const INFO_GRADIENT_COLORS = ["#042C83", "#6366f1"];

export default function OperationsGrid({
  // onScanLoad,
  onScanOffload,
  onScanInfo,
  onScanDelivery,
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Operations
      </Text>

      <View style={styles.gridContainer}>
        {/* ROW 1: Offload (main-truck load hidden for now) */}
        <View style={styles.row}>
          {/* A. LOAD TRUCK — main long-haul trip load; disabled for now
          <TouchableOpacity
            style={styles.gridBtnTouchable}
            onPress={onScanLoad}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={LOAD_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gridBtn}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="truck" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.btnTitle}>LOAD TRUCK</Text>
            </LinearGradient>
          </TouchableOpacity>
          */}

          {/* B. OFFLOAD */}
          <TouchableOpacity
            style={styles.gridBtnTouchable}
            onPress={onScanOffload}
          >
            <LinearGradient
              colors={OFFLOAD_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gridBtn}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="dolly" size={24} color="#10b981" />
              </View>
              <Text style={styles.btnTitle}>OFFLOAD TRUCK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ROW 2: Load (last-mile) + Scan Info */}
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.gridBtnTouchable}
            onPress={onScanDelivery}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={LOAD_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gridBtn}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="truck" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.btnTitle}>LOAD</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridBtnTouchable}
            onPress={onScanInfo}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={INFO_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gridBtn}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="qrcode" size={24} color="#6366f1" />
              </View>
              <Text style={styles.btnTitle}>SCAN INFO</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  gridContainer: { gap: 16 },
  row: { flexDirection: "row", gap: 16 },
  gridBtnTouchable: {
    flex: 1,
  },
  gridBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    minHeight: 104,
    justifyContent: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  btnTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
});
