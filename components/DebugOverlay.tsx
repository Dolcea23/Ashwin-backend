import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function DebugOverlay() {
  const [debugData, setDebugData] = useState({
    eeg: 0,
    ecg: 0,
    temp: 0,
    liveIndex: 0,
    connection: "⏸️ Waiting",
  });

  useEffect(() => {
    // show placeholder until live data streams
    setDebugData({
      eeg: 0,
      ecg: 0,
      temp: 0,
      liveIndex: 0,
      connection: "⏸️ No live data yet",
    });
  }, []);

  return (
    <View style={styles.debugBox}>
      <Text style={styles.debugText}>🧠 Debug Overlay</Text>
      <Text style={styles.debugSub}>EEG: {debugData.eeg || "–"}</Text>
      <Text style={styles.debugSub}>ECG: {debugData.ecg || "–"}</Text>
      <Text style={styles.debugSub}>Temp: {debugData.temp || "–"}</Text>
      <Text style={styles.debugSub}>Index: {debugData.liveIndex || "–"}</Text>
      <Text style={styles.debugSub}>Status: {debugData.connection}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  debugBox: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 10,
  },
  debugText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  debugSub: { color: "#ddd", fontSize: 12 },
});
