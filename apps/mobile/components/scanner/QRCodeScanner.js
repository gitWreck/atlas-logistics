import { CameraView, useCameraPermissions } from "expo-camera";
import { View, StyleSheet } from "react-native";

export default function QRCodeScanner({ onScan }) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    // Return a "Request Permission" view
    return <View />;
  }

  return (
    <CameraView
      style={StyleSheet.absoluteFillObject}
      onBarcodeScanned={({ data }) => {
        // Pass the data back to the parent (Checker or Driver page)
        onScan(data);
      }}
    />
  );
}
