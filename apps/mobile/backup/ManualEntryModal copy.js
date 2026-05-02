import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function ManualEntryModal({ visible, onClose, onSubmit }) {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [foundPackage, setFoundPackage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!visible) {
      setCode("");
      setQuantity("");
      setFoundPackage(null);
      setLoading(false);
    }
  }, [visible]);

  const handleLookup = async () => {
    console.log("Looking up code:", code);
    if (!code.trim()) return;

    setLoading(true);
    try {
      // Find the package to check if it's a Sack or Bundle
      const q = query(
        collection(db, "shipments"),
        where("packageBarcodes", "array-contains", code.trim()),
      );

      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const shipmentData = querySnap.docs[0].data();
        const pkg = shipmentData.packages.find(
          (p) => (p.packageId || p.trackingNumber) === code.trim(),
        );

        const isBulk =
          String(pkg?.packagingGroup || "").toUpperCase() === "BULK";

        if (isBulk) {
          // If bulk, stay in modal to ask for quantity
          setFoundPackage(pkg);
          setQuantity(pkg.quantity?.toString() || "1");
        } else {
          // If standard box, submit immediately
          onSubmit(code.trim());
        }
      } else {
        // Fallback: just submit and let the parent handle the "Not Found" error
        onSubmit(code.trim());
      }
    } catch (err) {
      console.error(err);
      onSubmit(code.trim()); // Submit anyway so parent handles error logic
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = () => {
    if (!quantity.trim()) return;

    const numQty = Number(quantity);
    const max = foundPackage?.quantity || 1;

    // Validation to prevent over-loading
    if (numQty > max) {
      alert(`Cannot exceed maximum quantity of ${max}`);
      return;
    }

    // Pass code and quantity back to handleProcessPackage in ScannerScreen
    onSubmit(code.trim(), numQty);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {foundPackage ? "Enter Quantity" : "Manual Entry"}
          </Text>
          <Text style={styles.modalSubtitle}>
            {foundPackage
              ? `This ${foundPackage.packagingType} contains ${foundPackage.quantity} pcs.`
              : "Type the tracking number exactly"}
          </Text>

          {!foundPackage ? (
            <TextInput
              style={styles.input}
              placeholder="AT-2026..."
              placeholderTextColor="#94a3b8"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          ) : (
            <View style={styles.qtyContainer}>
              <Text style={styles.qtyLabel}>Quantity to process:</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                autoFocus
              />
              <Text style={styles.maxText}>
                Max: {foundPackage.quantity} pcs
              </Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.submitBtn,
                loading && { opacity: 0.7 },
              ]}
              onPress={foundPackage ? handleFinalSubmit : handleLookup}
              disabled={loading}
            >
              <Text style={styles.submitText}>
                {loading ? "SEARCHING..." : foundPackage ? "CONFIRM" : "NEXT"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 10,
  },
  qtyContainer: {
    marginBottom: 20,
  },
  qtyLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  maxText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  modalActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 10 },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  submitBtn: { backgroundColor: "#3b82f6" },
  cancelText: { fontWeight: "700", color: "#64748b" },
  submitText: { fontWeight: "700", color: "#fff" },
});
