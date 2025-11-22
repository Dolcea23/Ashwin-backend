// src/components/DebugOverlay.tsx
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { calculateAshwinIndex } from "../api/AshwinIndex";
import { generateSensorData } from "../sensors/sensorMap";

export default function DebugOverlay() {
  const [visible, setVisible] = useState(true);
  const [data, setData] = useState({ eeg: 0, ecg: 0, temperature: 0, index: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = generateSensorData();
      const idx = calculateAshwinIndex(d);
      setData({ ...d, index: idx });
      console.log("🧠 DEBUG:", d, "Ashwin Index:", idx);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!visible) {
    return (
      <TouchableOpacity
        style={styles.hiddenButton}
        onPress={() => setVisible(true)}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>SHOW DEBUG</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay}>
      <Text style={styles.header}>🧠 DEBUG OVERLAY</Text>
      <Text style={styles.text}>EEG: {data.eeg.toFixed(2)}</Text>
      <Text style={styles.text}>ECG: {data.ecg.toFixed(2)}</Text>
      <Text style={styles.text}>Temp: {data.temperature.toFixed(2)} °F</Text>
      <Text style={styles.text}>Ashwin Index: {data.index.toFixed(2)}</Text>

      <TouchableOpacity
        style={styles.hideButton}
        onPress={() => setVisible(false)}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>HIDE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: "40%",
    left: "10%",
    backgroundColor: "rgba(13, 71, 161, 0.95)",
    padding: 20,
    borderRadius: 12,
    width: 250,
    zIndex: 9999,
  },
  header: {
    color: "#fff",
    fontWeight: "700",
    marginBottom: 5,
    textAlign: "center",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    marginVertical: 2,
  },
  hideButton: {
    marginTop: 8,
    backgroundColor: "#1565C0",
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: 6,
  },
  hiddenButton: {
    position: "absolute",
    bottom: 20,
    right: 10,
    backgroundColor: "#0D47A1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
