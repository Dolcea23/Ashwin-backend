import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DebugOverlay from "../../components/DebugOverlay";
import MorningSync from "../../components/MorningSync";
import { BASE_URL, fetchUserReport, sendSensorData } from "../../src/api/ashwinAPI";
import { connectToDevice, disconnectDevice } from "../../utils/bleService";
import { getHistory, saveSession } from "../../utils/storage";
import { getTrialStatus } from "../../utils/trialManager";

const { width, height } = Dimensions.get("window");

export default function Home() {
  const [score, setScore] = useState<number>(75);
  const [feedback, setFeedback] = useState<string>(
    "Your readings place you in a stable recovery zone. Maintain consistent rest and hydration."
  );
  const [motivation, setMotivation] = useState<string>(
    "Every calm moment builds your foundation. Keep going."
  );
  const [prediction, setPrediction] = useState<string>("–");
  const [confidence, setConfidence] = useState<number>(0);
  const [bestDay, setBestDay] = useState<string>("-");
  const [okDay, setOkDay] = useState<string>("-");
  const [lowDay, setLowDay] = useState<string>("–");
  const [trial, setTrial] = useState<{ active: boolean; daysLeft: number; expired?: boolean }>({
    active: false,
    daysLeft: 0,
    expired: false,
  });

  // --- Load trial status ---
  useEffect(() => {
    (async () => {
      const t = await getTrialStatus();
      setTrial(t);
    })();
  }, []);

  // --- BLE device connection + live updates ---
  useEffect(() => {
    connectToDevice((data: any) => {
      if (data?.heartRate) {
        const hr = Math.round(data.heartRate);
        const newScore = Math.min(100, Math.max(0, 100 - Math.abs(hr - 75)));
        setScore(newScore);
        updateFeedback(newScore);
        saveSession(newScore, "Auto");
        loadHistory();
        console.log("💓 Live BLE data received:", data);
      }
    });
    return () => disconnectDevice();
  }, []);

  // --- Fetch history ---
  const loadHistory = async () => {
    const history = await getHistory();
    if (history?.length > 0) {
      const sorted = [...history].sort((a, b) => b.ranking - a.ranking);
      setBestDay(sorted[0]?.date || "-");
      setLowDay(sorted[sorted.length - 1]?.date || "-");
      const mid = Math.floor(sorted.length / 2);
      setOkDay(sorted[mid]?.date || "-");
    }
  };

  // --- Feedback logic ---
  const updateFeedback = (s: number) => {
    if (s >= 86) {
      setFeedback("Excellent stability detected. Maintain your current rhythm.");
      setMotivation("You’re in sync — protect your peace and keep the flow.");
    } else if (s >= 71) {
      setFeedback("Stable recovery pattern. Minor stress adjustments observed.");
      setMotivation("Small habits are compounding — keep your consistency.");
    } else if (s >= 51) {
      setFeedback("Moderate balance. Some signs of fatigue detected.");
      setMotivation("Stay centered — recovery builds from awareness.");
    } else if (s >= 31) {
      setFeedback("Unstable rhythm — your body may be seeking rest.");
      setMotivation("Recharge intentionally. Stillness is progress too.");
    } else {
      setFeedback("Critical imbalance — step back and recover fully.");
      setMotivation("Your body is asking for care — pause, breathe, reset.");
    }
  };

  // --- Test backend + predictive analysis ---
  const testBackend = async () => {
    try {
      const res = await sendSensorData(1, "EEG", Math.random());
      console.log("✅ Sent:", res);

      const report = await fetchUserReport(1);
      console.log("📊 Report:", report);

      const trend = await fetch(`${BASE_URL}/analyze/trend/1`);
      const trendData = await trend.json();
      console.log("🧠 Prediction:", trendData);

      setPrediction(trendData.prediction);
      setConfidence(trendData.confidence);

      Alert.alert(
        "Backend Connected",
        `Ashwin Index: ${report.ashwin_index}\nTrend: ${trendData.trend}`
      );
    } catch (err: any) {
      console.error("❌ Error:", err);
      Alert.alert("Error", "Failed to reach backend.");
    }
  };

  const getColor = (s: number) => {
    if (s >= 86) return "#2196F3";
    if (s >= 71) return "#4CAF50";
    if (s >= 51) return "#FFC107";
    if (s >= 31) return "#FF9800";
    return "#F44336";
  };

  const circleColor = getColor(score);
  const circleSize = Math.min(width * 0.45, 180);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <MorningSync />

      <View style={styles.container}>
        <Text style={[styles.header, { fontSize: width * 0.055 }]}>
          🎉 Welcome back, Jordan
        </Text>
        <Text style={[styles.subtext, { fontSize: width * 0.035 }]}>
          Your current wellness snapshot.
        </Text>

        {/* Test backend button */}
        <View style={{ marginVertical: 10 }}>
          <Button title="⚡ Test Backend Connection" onPress={testBackend} />
        </View>

        {/* Score Circle */}
        <View
          style={[
            styles.circle,
            {
              backgroundColor: circleColor,
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
            },
          ]}
        >
          <Text style={[styles.circleText, { fontSize: circleSize * 0.35 }]}>
            {Math.round(score)}
          </Text>
        </View>

        <Text style={[styles.scoreLabel, { fontSize: width * 0.04 }]}>
          Ashwin Feedback Index ({Math.round(score)}/100)
        </Text>

        {/* Progress Bar */}
        <View style={styles.barContainer}>
          <View style={styles.barGradient}>
            <View style={[styles.segment, { backgroundColor: "#F44336" }]} />
            <View style={[styles.segment, { backgroundColor: "#FF9800" }]} />
            <View style={[styles.segment, { backgroundColor: "#FFC107" }]} />
            <View style={[styles.segment, { backgroundColor: "#4CAF50" }]} />
            <View style={[styles.segment, { backgroundColor: "#2196F3" }]} />
          </View>
          <View style={styles.barLabels}>
            {["0", "30", "50", "70", "85", "100"].map((n) => (
              <Text key={n} style={styles.label}>
                {n}
              </Text>
            ))}
          </View>
        </View>

        {/* Feedback + Motivation */}
        <Text style={styles.sectionTitle}>Ashwin Feedback</Text>
        <Text style={styles.sectionText}>{feedback}</Text>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Motivation</Text>
        <Text style={styles.sectionText}>{motivation}</Text>

        {/* AI Prediction */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>AI Prediction</Text>
        <Text style={styles.sectionText}>
          {prediction}{"\n"}
          <Text style={{ fontSize: 12, color: "#888" }}>
            Confidence: {(confidence * 100).toFixed(0)}%
          </Text>
        </Text>

        {/* Weekly Summary */}
        <View style={styles.trackerSection}>
          <Text style={styles.trackerTitle}>Weekly Summary</Text>
          <View style={styles.trackerRow}>
            <Text style={[styles.trackerLabel, { color: "#4CAF50" }]}>🟢 Best Day:</Text>
            <Text style={styles.trackerValue}>{bestDay}</Text>
          </View>
          <View style={styles.trackerRow}>
            <Text style={[styles.trackerLabel, { color: "#FFC107" }]}>🟡 Okay Day:</Text>
            <Text style={styles.trackerValue}>{okDay}</Text>
          </View>
          <View style={styles.trackerRow}>
            <Text style={[styles.trackerLabel, { color: "#F44336" }]}>🔴 Low Day:</Text>
            <Text style={styles.trackerValue}>{lowDay}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          © 2025 Ashwin Wellness • Powered by the Ashwin Feedback System™
        </Text>
      </View>

      <DebugOverlay />
    </ScrollView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: height * 0.05,
  },
  container: {
    width: "100%",
    alignItems: "center",
  },
  header: { fontWeight: "700", color: "#0D47A1", textAlign: "center" },
  subtext: { color: "#555", marginTop: 4, textAlign: "center" },
  circle: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  circleText: { color: "#fff", fontWeight: "700" },
  scoreLabel: { color: "#333", marginBottom: 8 },
  barContainer: { alignItems: "center", marginVertical: 10 },
  barGradient: {
    flexDirection: "row",
    height: 12,
    width: width * 0.7,
    borderRadius: 6,
    overflow: "hidden",
  },
  segment: { flex: 1 },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: width * 0.7,
    paddingTop: 4,
  },
  label: { fontSize: 10, color: "#444" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0D47A1",
    marginBottom: 4,
    textAlign: "center",
  },
  sectionText: {
    fontSize: 13,
    color: "#333",
    textAlign: "center",
    lineHeight: 18,
    width: "90%",
  },
  trackerSection: { width: "100%", marginTop: 16 },
  trackerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0D47A1",
    marginBottom: 6,
    textAlign: "center",
  },
  trackerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.18,
    marginVertical: 3,
  },
  trackerLabel: { fontSize: 13, fontWeight: "600" },
  trackerValue: { fontSize: 13, color: "#333" },
  footer: { fontSize: 11, color: "#888", textAlign: "center", marginTop: 16 },
});
