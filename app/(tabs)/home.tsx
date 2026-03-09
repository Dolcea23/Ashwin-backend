import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import MorningSync from "../../components/MorningSync";
import { fetchPrediction } from "../../src/api/predictiveAPI";
import { getHistory } from "../../utils/storage";
import { getTrialStatus } from "../../utils/trialManager";

const { width, height } = Dimensions.get("window");

// Backend constant (Cloudflare Tunnel → REAL DOMAIN)
import { BACKEND } from "../../src/api/apiConfig";


export default function Home() {
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>(
    "Start a live session to receive your readings."
  );
  const [motivation, setMotivation] = useState<string>(
    "Your journey starts when you breathe with intention."
  );
  const [prediction, setPrediction] = useState<string>("–");
  const [confidence, setConfidence] = useState<number>(0);
  const [bestDay, setBestDay] = useState<string>("-");
  const [okDay, setOkDay] = useState<string>("-");
  const [lowDay, setLowDay] = useState<string>("–");

  const [trial, setTrial] = useState({
    active: false,
    daysLeft: 0,
    expired: false,
  });

  // ✅ NEW (minimal): determine which userId to pull
  const [userId, setUserId] = useState<number>(1);

  // Load trial status
  useEffect(() => {
    (async () => {
      const t = await getTrialStatus();
      setTrial(t);
    })();
  }, []);

  // Load local history for weekly summary
  useEffect(() => {
    loadHistory();
  }, []);

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

  // ✅ NEW (minimal): load user id from storage (same approach as Live)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("ASHWIN_USER");
        if (stored) {
          const parsed = JSON.parse(stored);
          const id = parsed.userId || parsed.id;
          if (id) {
            setUserId(Number(id));
            return;
          }
        }
        const fallback = await AsyncStorage.getItem("ASHWIN_USER_ID");
        if (fallback) setUserId(Number(fallback));
      } catch {}
    })();
  }, []);

  // ✅ NEW (minimal): Home “bird’s-eye” poll of index (slower than Live)
  const fetchHomeIndex = async () => {
    try {
      const res = await fetch(`${BACKEND}/ashwin/index/${userId}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data?.index != null) {
        const s = Number(data.index);
        setScore(s);
        updateFeedback(s); // keep your same behavior
      }
    } catch {}
  };

  // ✅ NEW: poll every 10s (snapshot cadence)
  useEffect(() => {
    fetchHomeIndex();
    const interval = setInterval(fetchHomeIndex, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  // AI Prediction (from backend) — keep same function, just use userId
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchPrediction(userId);
        if (!res) return;
        if (res.message || res.prediction) {
          setPrediction(
            res.message
              ? `${res.message}${res.trend ? ` • Trend: ${res.trend}` : ""}`
              : res.prediction
          );
        }
        if (typeof res.confidence === "number") {
          setConfidence(res.confidence);
        }
      } catch {}
    })();
  }, [userId]);

  const updateFeedback = (s: number) => {
    if (s >= 86) {
      setFeedback("Excellent mind-body stability.");
      setMotivation("You’re aligned — keep protecting your rhythm.");
    } else if (s >= 71) {
      setFeedback("Strong balance with minor stress signals.");
      setMotivation("Consistency compounds — you’re building strength.");
    } else if (s >= 51) {
      setFeedback("Moderate balance — signs of fatigue detected.");
      setMotivation("Stay intentional. Recovery is still progress.");
    } else if (s >= 31) {
      setFeedback("Unstable pattern — recovery needed.");
      setMotivation("Rest with purpose. Your body speaks first.");
    } else if (s > 0) {
      setFeedback("Critical imbalance — slow down and reset.");
      setMotivation("Your body needs care. Breathe and recalibrate.");
    }
  };

  const getColor = (s: number) => {
    if (s >= 86) return "#2196F3";
    if (s >= 71) return "#4CAF50";
    if (s >= 51) return "#FFC107";
    if (s >= 31) return "#FF9800";
    return "#E0E0E0";
  };

  const circleColor = getColor(score);
  const circleSize = Math.min(width * 0.45, 180);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <MorningSync />

      <View style={styles.container}>
        <Text style={[styles.header, { fontSize: width * 0.055 }]}>
          Welcome back, Jordan
        </Text>
        <Text style={[styles.subtext, { fontSize: width * 0.035 }]}>
          Your current wellness snapshot.
        </Text>

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

        {/* Feedback */}
        <Text style={styles.sectionTitle}>Ashwin Feedback</Text>
        <Text style={styles.sectionText}>{feedback}</Text>

        {/* Motivation */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          Motivation
        </Text>
        <Text style={styles.sectionText}>{motivation}</Text>

        {/* AI Prediction */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          AI Prediction
        </Text>
        <Text style={styles.sectionText}>
          {prediction}
          {"\n"}
          <Text style={{ fontSize: 12, color: "#888" }}>
            Confidence: {(confidence * 100).toFixed(0)}%
          </Text>
        </Text>

        {/* Weekly Summary */}
        <View style={styles.trackerSection}>
          <Text style={styles.trackerTitle}>Weekly Summary</Text>
          <View style={styles.trackerRow}>
            <Text style={[styles.trackerLabel, { color: "#4CAF50" }]}>
              🟢 Best Day:
            </Text>
            <Text style={styles.trackerValue}>{bestDay}</Text>
          </View>
          <View style={styles.trackerRow}>
            <Text style={[styles.trackerLabel, { color: "#FFC107" }]}>
              🟡 Okay Day:
            </Text>
            <Text style={styles.trackerValue}>{okDay}</Text>
          </View>
          <View style={styles.trackerRow}>
            <Text style={[styles.trackerLabel, { color: "#F44336" }]}>
              🔴 Low Day:
            </Text>
            <Text style={styles.trackerValue}>{lowDay}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          © 2025 Ashwin Wellness • Powered by the Ashwin Feedback System™
        </Text>
      </View>
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
  container: { width: "100%", alignItems: "center" },
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
console.log("BACKEND =", BACKEND);
