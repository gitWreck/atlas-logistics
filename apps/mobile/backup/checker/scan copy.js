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
  doc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../../firebase";

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

    console.log("scanned data: ", data);

    try {
      // STEP 1: Find the Shipment containing this barcode
      const q = query(
        collection(db, "shipments"),
        where("packageBarcodes", "array-contains", data),
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        throw new Error("Package not found in any shipment.");
      }

      const shipmentDoc = querySnapshot.docs[0];
      const shipmentData = shipmentDoc.data();
      const shipmentId = shipmentDoc.id;

      // STEP 2: RULE CHECK - Must be assigned to a trip
      if (!shipmentData.currentTruckTripId) {
        throw new Error(
          `Shipment ${shipmentId} is NOT assigned to a trip yet.`,
        );
      }

      // If Manual Mode, show details
      if (mode === "manual") {
        router.push({
          pathname: "/(checker)/scan-result",
          params: { packageId: shipmentId },
        });
        setProcessing(false);
        return;
      }

      const targetPackage = shipmentData.packages.find(
        (p) => p.trackingNumber === data,
      );
      const oldStatus = targetPackage.status || "PENDING"; // Default to PENDING if undefined

      // Prevent redundant scans
      if (mode === "loading" && oldStatus === "LOADED")
        throw new Error("Already Loaded");
      if (mode === "receiving" && oldStatus === "RECEIVED")
        throw new Error("Already Received");

      // 1. Get the Firestore Number Updates
      const totalUpdates = getCountUpdates(oldStatus, mode);
      const batch = writeBatch(db);

      // REFS
      const shipmentRef = doc(db, "shipments", shipmentId);

      // STEP 3: Update the specific package status inside the array
      const updatedPackages = shipmentData.packages.map((pkg) => {
        if (pkg.trackingNumber === data) {
          return {
            ...pkg,
            status: mode === "loading" ? "LOADED" : "RECEIVED",
            loadedAt:
              mode === "loading" ? new Date().toISOString() : pkg.loadedAt,
            loadedOnTrip:
              mode === "loading"
                ? shipmentData.currentTruckTripId
                : pkg.loadedOnTrip,
          };
        }
        return pkg;
      });

      // Recalculate Totals
      const newTotals = { ...shipmentData.totals };
      if (mode === "loading") newTotals.loaded += 1;
      if (mode === "receiving") newTotals.received += 1;

      // STEP 4: Write to Firestore
      // const shipmentRef = doc(db, "shipments", shipmentId);
      // await updateDoc(shipmentRef, {
      //   packages: updatedPackages,
      //   updatedAt: serverTimestamp(),
      //   ...totalUpdates,
      // });

      // 2. Add Shipment Update to Batch
      batch.update(shipmentRef, {
        packages: updatedPackages,
        updatedAt: serverTimestamp(),
        // Update the Shipment-level totals
        "totals.loaded": increment(mode === "loading" ? 1 : -1),
        "totals.received": increment(mode === "receiving" ? 1 : 0), // Adjust logic if needed
      });

      // 👇👇👇 STEP 5: SYNC TO TRUCK TRIP (NEW CODE) 👇👇👇
      if (shipmentData.currentTruckTripId) {
        try {
          const tripShipmentRef = doc(
            db,
            "truck_trips",
            shipmentData.currentTruckTripId,
            "trip_shipments",
            shipmentId,
          );

          // Calculate the change based on mode
          // If LOADING: +1 Loaded
          // If UNLOADING (Receiving): -1 Loaded (optional, depends if you want to track offloading)

          if (mode === "loading") {
            // ✅ LOAD: Move from Pending to Loaded
            await updateDoc(tripShipmentRef, {
              loadedCount: increment(1),
              pendingCount: increment(-1), // Decrease pending!
              updatedAt: serverTimestamp(),
            });
          } else if (mode === "receiving") {
            // ✅ UNLOAD: Move from Loaded back to Pending (or just off the truck)
            // If you are unloading at the destination, you might not want to increase pending.
            // But if you are just correcting a mistake, you swap them back.
            await updateDoc(tripShipmentRef, {
              loadedCount: increment(-1),
              pendingCount: increment(1), // Put it back in pending
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to sync trip count:", err);
          // We don't throw an error here because the main shipment
          // WAS updated successfully. We just log it.
        }
      }
      // 👆👆👆 END NEW CODE 👆👆👆

      Alert.alert(
        "Success",
        `${mode === "loading" ? "Loaded" : "Received"}: ${data}`,
        [
          {
            text: "Scan Next",
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
