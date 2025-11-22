import { useEffect, useState } from "react";
import { Dimensions, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { fetchPrediction, fetchTrend, fetchUserReport } from "../../src/api/ashwinAPI";
import { calculateAshwinIndex } from "../../src/api/AshwinIndex";
import DebugOverlay from "../../src/components/DebugOverlay";
import { getAverageScore, recordScore } from "../../src/utils/analytics";
import { connectToDevice, debugScanBLE, disconnectDevice } from "../../utils/bleService";

export default function Dashboard() {
  const [series, setSeries] = useState<number[]>([]);
  const [avg, setAvg] = useState(0);
  const [status, setStatus] = useState("🔍 Scanning for device...");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [trend, setTrend] = useState<string | null>(null);

  useEffect(() => {
    connectToDevice((data: any) => {
      if (data?.eeg && data?.ecg && data?.temperature) {
        const score = calculateAshwinIndex(data);
        recordScore(score);
        setAvg(getAverageScore());
        setSeries((prev) => [...prev.slice(-19), score]);
        setStatus(`📡 Live Stream Active → ${score.toFixed(1)}`);
      }
    })
      .then(() => setStatus("✅ Connected to Ashwin Sensor"))
      .catch((err) => {
        console.error("❌ BLE Error:", err);
        setStatus("❌ Connection failed. Retrying...");
        setTimeout(() => {
          connectToDevice(() => {});
        }, 5000);
      });

    return () => disconnectDevice();
  }, []);

  useEffect(() => {
    async function loadReports() {
      await fetchUserReport(1);
      const trendData = await fetchTrend(1);
      const predData = await fetchPrediction(1);
      if (predData?.prediction) {
        setPrediction(predData.prediction);
        setTrend(predData.trend);
      }
    }
    loadReports();
  }, [series]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ alignItems: "center", padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#0D47A1", marginVertical: 10 }}>
          Live Dashboard
        </Text>
        <Text style={{ fontSize: 14, color: "#444", marginBottom: 10 }}>{status}</Text>

        {deviceName && (
          <View style={{ backgroundColor: "#E3F2FD", padding: 10, borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 14, color: "#0D47A1" }}>🧠 Device: {deviceName}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={debugScanBLE}
          style={{
            backgroundColor: "#1976D2",
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>🔍 Scan for Nearby BLE Devices</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 16, marginBottom: 10 }}>
          Average MoodScore: <Text style={{ fontWeight: "700" }}>{avg.toFixed(1)}</Text>
        </Text>

        {prediction && (
          <Text style={{ fontSize: 15, color: "#0D47A1", marginBottom: 15 }}>
            🔮 Predicted Next Index: <Text style={{ fontWeight: "700" }}>{prediction}</Text> ({trend})
          </Text>
        )}

        {series.length === 0 ? (
          <Text style={{ marginTop: 50, color: "#888" }}>⏳ Waiting for first BLE sample...</Text>
        ) : (
          <LineChart
            data={{
              labels: series.map((_, i) => (i % 2 === 0 ? i.toString() : "")),
              datasets: [{ data: series }],
            }}
            width={Dimensions.get("window").width - 40}
            height={220}
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#f0f4ff",
              backgroundGradientTo: "#e3f2fd",
              color: (opacity = 1) => `rgba(13, 71, 161, ${opacity})`,
              labelColor: () => "#333",
              strokeWidth: 2,
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        )}
      </ScrollView>

      <DebugOverlay />
    </SafeAreaView>
  );
}
