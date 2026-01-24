import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Alert,
  Vibration,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch,
  doc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../../../firebase";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const router = useRouter();
  const { mode } = useLocalSearchParams();

  // 1. Permission Check
  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission is required.</Text>
        <Text onPress={requestPermission} style={styles.link}>
          Grant Permission
        </Text>
      </View>
    );
  }

  const getCountUpdates = (oldStatus, newMode) => {
    const updates = {};

    // 1. DETERMINE THE "FROM" BUCKET (What do we subtract?)
    if (oldStatus === "PENDING" || !oldStatus) {
      updates["totals.pending"] = increment(-1);
    } else if (oldStatus === "RECEIVED") {
      updates["totals.received"] = increment(-1);
    } else if (oldStatus === "LOADED") {
      updates["totals.loaded"] = increment(-1);
    }

    // 2. DETERMINE THE "TO" BUCKET (What do we add?)
    if (newMode === "loading") {
      updates["totals.loaded"] = increment(1);
    } else if (newMode === "receiving") {
      updates["totals.received"] = increment(1);
    } else if (newMode === "delivered") {
      // (For your manual mode)
      updates["totals.delivered"] = increment(1);
    }

    return updates;
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    Vibration.vibrate();

    // 1. GET CURRENT USER (The Checker)
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert("Error", "You must be logged in.");
      setScanned(false);
      setProcessing(false);
      return;
    }

    try {
      // --- STEP 1: READ ---
      const q = query(
        collection(db, "shipments"),
        where("packageBarcodes", "array-contains", data),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) throw new Error("Package not found.");

      const shipmentDoc = querySnapshot.docs[0];
      const shipmentData = shipmentDoc.data();
      const shipmentId = shipmentDoc.id;

      if (!shipmentData.currentTruckTripId) {
        throw new Error(`Shipment not assigned to a trip.`);
      }

      const targetPackage = shipmentData.packages.find(
        (p) => p.trackingNumber === data,
      );
      if (!targetPackage) throw new Error("Package data missing.");

      const oldStatus = targetPackage.status || "PENDING";

      // Check duplicates
      if (mode === "loading" && oldStatus === "LOADED")
        throw new Error("Already Loaded");
      if (mode === "receiving" && oldStatus === "RECEIVED")
        throw new Error("Already Received");

      // --- STEP 2: PREPARE DATA ---

      // A. Get Dynamic Count Updates using your helper
      const totalUpdates = getCountUpdates(oldStatus, mode);

      // B. Update Package Array
      const updatedPackages = shipmentData.packages.map((pkg) => {
        if (pkg.trackingNumber === data) {
          return {
            ...pkg,
            status: mode === "loading" ? "LOADED" : "RECEIVED",
            loadedAt:
              mode === "loading" ? new Date().toISOString() : pkg.loadedAt,
            // ✅ WHO LOADED IT? (New Feature)
            loadedBy: mode === "loading" ? userId : pkg.loadedBy,
            loadedOnTrip:
              mode === "loading"
                ? shipmentData.currentTruckTripId
                : pkg.loadedOnTrip,
          };
        }
        return pkg;
      });

      // --- STEP 3: BATCH WRITE ---
      const batch = writeBatch(db);
      const tripId = shipmentData.currentTruckTripId;

      // 1. Update Shipment (Spread your helper's updates here)
      const shipmentRef = doc(db, "shipments", shipmentId);
      batch.update(shipmentRef, {
        packages: updatedPackages,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
        ...totalUpdates, // ✅ Safely applies +1 / -1 logic
      });

      // 2. Update Trip Shipment (Sub-collection)
      const tripShipmentRef = doc(
        db,
        "truck_trips",
        tripId,
        "trip_shipments",
        shipmentId,
      );
      if (mode === "loading") {
        batch.update(tripShipmentRef, {
          loadedCount: increment(1),
          pendingCount: increment(-1),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
      } else if (mode === "receiving") {
        // Logic depends on if you want to decrease loaded count
        batch.update(tripShipmentRef, {
          loadedCount: increment(-1),
          pendingCount: increment(1),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
      }

      // 3. Update Root Trip
      const rootTripRef = doc(db, "truck_trips", tripId);
      if (mode === "loading") {
        batch.update(rootTripRef, {
          totalLoaded: increment(1),
          itemPending: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } else if (mode === "receiving") {
        batch.update(rootTripRef, {
          totalLoaded: increment(-1),
          itemPending: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      Alert.alert(
        "Success",
        `${mode === "loading" ? "Loaded" : "Received"}: ${data}`,
        [
          {
            text: "Next",
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", error.message, [
        {
          text: "OK",
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "ean13", // Standard retail products
            "ean8", // Smaller retail products
            "upc_e", // US products
            "code128", // 📦 Very common for logistics/shipping labels
            "code39", // Older logistics standard
            "pdf417", // Complex labels (like on IDs or shipping manifests)
          ],
        }}
      >
        <View style={styles.overlay}>
          {processing && (
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{ marginBottom: 20 }}
            />
          )}
          <Text style={styles.overlayText}>Mode: {mode?.toUpperCase()}</Text>
          <View
            style={[styles.square, processing && { borderColor: "yellow" }]}
          />
          <Text style={styles.instruction}>
            Scan individual package barcode
          </Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 40,
    top: -50,
    textShadowColor: "black",
    textShadowRadius: 10,
  },
  instruction: {
    color: "#e2e8f0",
    marginTop: 20,
    fontSize: 14,
  },
  square: {
    width: 260,
    height: 260,
    borderWidth: 4,
    borderColor: "#2563eb",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  link: { color: "blue", marginTop: 10, fontWeight: "bold" },
});
