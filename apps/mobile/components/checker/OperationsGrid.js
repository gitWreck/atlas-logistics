// components/checker/OperationsGrid.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const GRADIENT_COLORS = ["#042C83", "#07B9F4"];

export default function OperationsGrid({
  onScanLoad,
  onScanOffload,
  onScanInfo, // <--- New Prop
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Operations</Text>

      <View style={styles.gridContainer}>
        {/* ROW 1: Load & Offload */}
        <View style={styles.row}>
          {/* A. LOAD TRUCK */}
          {/* <TouchableOpacity
            style={styles.gridBtnTouchable}
            onPress={onScanLoad}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gridBtn}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="truck" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.btnTitle}>LOAD TRUCK</Text>
              <Text style={styles.btnSub}>Scan to vehicle</Text>
            </LinearGradient>
          </TouchableOpacity> */}

          {/* B. OFFLOAD */}
          <TouchableOpacity
            style={styles.gridBtnTouchable}
            onPress={onScanOffload}
          >
            <LinearGradient
              colors={GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gridBtn}
            >
              <View style={styles.iconCircle}>
                <FontAwesome5 name="truck" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.btnTitle}>OFFLOAD TRUCK</Text>
              <Text style={styles.btnSub}>Scan shipment to vehicle</Text>
            </LinearGradient>
            {/* <View style={[styles.iconCircle, { backgroundColor: "#f1f5f9" }]}>
              <FontAwesome5 name="dolly" size={24} color="#64748b" />
            </View>
            <Text style={[styles.btnTitle, styles.btnTitleSecondary]}>
              OFFLOAD
            </Text>
            <Text style={[styles.btnSub, styles.btnSubSecondary]}>
              Inbound scan
            </Text> */}
          </TouchableOpacity>
        </View>

        {/* ROW 2: Scan Info */}
        <View style={styles.row}>
          {/* C. SCAN INFO (New Button) */}
          <TouchableOpacity
            style={[
              styles.gridBtn,
              {
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#cbd5e1",
              },
            ]}
            onPress={onScanInfo}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: "#f3e8ff" }]}>
              <FontAwesome5 name="qrcode" size={24} color="#9333ea" />
            </View>
            <Text style={[styles.btnTitle, styles.btnTitleSecondary]}>
              SCAN INFO
            </Text>
            <Text style={[styles.btnSub, styles.btnSubSecondary]}>
              Check shipment, trip, or package details
            </Text>
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
    padding: 20,
    borderRadius: 20,
    minHeight: 140,
    justifyContent: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  btnTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  btnSub: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  btnTitleSecondary: { color: "#0f172a" },
  btnSubSecondary: { color: "#64748b" },
});
