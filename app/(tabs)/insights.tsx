import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { BACKEND } from "../../src/api/apiConfig";
import { fetchPrediction } from "../../src/api/predictiveAPI";
import { achievements, evaluateAchievements } from "../../src/utils/rewardSystem";
import { getTrialStatus } from "../../utils/trialManager";

type Session = {
  date: string;
  eegCalmness: number;
  ecgRhythm: number;
  edaStress: number;
};

// Gate (minimum number of samples before insights feel real)
const REQUIRED_SAMPLES = 10;

// DEV UNLOCK: if any score >= 50, unlock all features for testing
const UNLOCK_THRESHOLD = 50;

// (optional) keep for future caching use
const PERSIST_KEY = "ASHWIN_INSIGHTS_CACHE_v1";

export default function Insights() {
  const [history, setHistory] = useState<Session[]>([]);
  const [avgIndex, setAvgIndex] = useState(0);
  const [best, setBest] = useState(0);
  const [low, setLow] = useState(0);
  const [summary, setSummary] = useState("No insights yet — start your first live session.");
  const [trial, setTrial] = useState<{ active: boolean; daysLeft: number }>({
    active: false,
    daysLeft: 0,
  });

  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [tier, setTier] = useState<"Bronze" | "Silver" | "Gold" | "Ultra">("Bronze");

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const computeAshwinIndex = (s: Session) => {
    const calm = s.eegCalmness ?? 0;
    const rhythm = s.ecgRhythm ?? 0;
    const stress = 100 - (s.edaStress ?? 0);
    return Math.round(0.4 * calm + 0.4 * rhythm + 0.2 * stress);
  };

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 280, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  // helper: turn big timestamps into MM/DD for chart labels
  const formatShortDate = (raw: string) => {
    const s = String(raw || "");
    // match 2026-01-27 or 2026-01-27T...
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[2]}/${m[3]}`;
    // fallback: first 5 chars
    return s.length > 5 ? s.slice(0, 5) : s;
  };

  useEffect(() => {
    let alive = true;
    let timer: any = null;

    const load = async () => {
      try {
        // ✅ Load userId like Live/Home
        let uid = 1;
        try {
          const stored = await AsyncStorage.getItem("ASHWIN_USER");
          if (stored) {
            const parsed = JSON.parse(stored);
            const id = parsed.userId || parsed.id;
            if (id) uid = Number(id);
          } else {
            const fallback = await AsyncStorage.getItem("ASHWIN_USER_ID");
            if (fallback) uid = Number(fallback);
          }
        } catch {
          // keep uid=1
        }

        // ✅ Pull from LIVE endpoint first
        const tryUrls = [
          `${BACKEND}/api/recent?user=${uid}&limit=300`,
          `${BACKEND}/report/${uid}`,
          `${BACKEND}/insights/${uid}`,
        ];

        let data: any = null;

        for (const url of tryUrls) {
          const r = await fetch(url);
          if (r.ok) {
            data = await r.json();
            break;
          }
        }

        if (!data) {
          if (!alive) return;
          setSummary("Collecting data… Insights unlock after enough sessions are recorded.");
          return;
        }

        // -----------------------------
        // Normalize payload to Session[]
        // -----------------------------
        let arr: any[] = [];
        if (Array.isArray(data)) arr = data;
        else if (Array.isArray(data?.sessions)) arr = data.sessions;
        else if (Array.isArray(data?.history)) arr = data.history;
        else if (Array.isArray(data?.readings)) arr = data.readings;
        else if (Array.isArray(data?.data)) arr = data.data;
        else if (Array.isArray(data?.points)) arr = data.points; // /api/recent
        else arr = [];

        const clamp01 = (v: number) => Math.max(0, Math.min(100, isFinite(v) ? v : 0));

const dayKeyFrom = (x: any, fallbackIdx: number) => {
  const raw =
    x?.t || x?.timestamp || x?.date || x?.time || x?.created_at || x?.start_time || "";
  const s = String(raw);
  // prefer YYYY-MM-DD if present
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return `DAY${fallbackIdx + 1}`;
};

// 1) turn each point into a 0-100 score
const scored = arr.map((x: any, idx: number) => {
  const harmony =
    x?.harmony != null ? Number(x.harmony) :
    x?.harmony_score != null ? Number(x.harmony_score) :
    null;

  const eegCalmness =
    harmony != null ? harmony :
    Number(x?.eegCalmness ?? x?.brain_calm_score ?? x?.eeg_calm ?? x?.eeg ?? 0);

  const ecgRhythm =
    harmony != null ? harmony :
    Number(x?.ecgRhythm ?? x?.heart_rhythm_score ?? x?.ecg_rhythm ?? x?.ecg ?? 0);

  const edaStress =
    harmony != null ? (100 - harmony) :
    Number(
      x?.edaStress ??
      x?.stress ??
      x?.stress_score ??
      (x?.harmony_score != null ? 100 - Number(x.harmony_score) : 0)
    );

  const session: Session = {
    date: dayKeyFrom(x, idx),
    eegCalmness: clamp01(eegCalmness),
    ecgRhythm: clamp01(ecgRhythm),
    edaStress: clamp01(edaStress),
  };

  const score = computeAshwinIndex(session); // 0–100
  return { day: session.date, score };
});

// 2) group scores by day + average
const byDay: Record<string, { sum: number; n: number }> = {};
for (const row of scored) {
  if (!byDay[row.day]) byDay[row.day] = { sum: 0, n: 0 };
  byDay[row.day].sum += row.score;
  byDay[row.day].n += 1;
}

const daysSorted = Object.keys(byDay).sort(); // YYYY-MM-DD sorts correctly
const last7Days = daysSorted.slice(-7);

// 3) build Session[] where each entry is ONE DAY (avg score)
const mapped: Session[] = last7Days.map((day) => {
  const avgScore = Math.round(byDay[day].sum / Math.max(1, byDay[day].n));

  // store avgScore so computeAshwinIndex returns avgScore again
  return {
    date: day,
    eegCalmness: avgScore,
    ecgRhythm: avgScore,
    edaStress: 100 - avgScore,
  };
});

        if (!alive) return;

        if (mapped.length === 0) {
          setSummary("No live data yet. Once your sessions stream, insights will appear here.");
          setHistory([]);
          setAvgIndex(0);
          setBest(0);
          setLow(0);
          return;
        }

        setHistory(mapped);

        const scores = mapped.map((s) => computeAshwinIndex(s));
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

        const avgRounded = Math.round(avg);
        const bestScore = Math.max(...scores);
        const lowScore = Math.min(...scores);

        setAvgIndex(avgRounded);
        setBest(bestScore);
        setLow(lowScore);

        // ✅ DEV UNLOCK
        const unlockAll = bestScore >= UNLOCK_THRESHOLD;

        if (unlockAll) {
          setTier("Ultra");
          setUnlocked(achievements.map((a) => a.id));
          setSummary("✅ Dev unlock active: score ≥ 50 detected. All Insights features unlocked for testing.");
          triggerPulse();
        } else {
          if (avg >= 88) setTier("Ultra");
          else if (avg >= 82) setTier("Gold");
          else if (avg >= 75) setTier("Silver");
          else setTier("Bronze");

          const progress = { avg, streak: 0, sessions: mapped.length };
          const { allUnlocked } = evaluateAchievements(progress, []);
          setUnlocked(allUnlocked);
          if (allUnlocked.length > 0) triggerPulse();

          if (avg >= 80) setSummary("Strong balance detected — your calm and rhythm are in sync.");
          else if (avg >= 60) setSummary("Steady energy — minor dips, but good recovery overall.");
          else setSummary("Fluctuating rhythm — take time to rest and recharge.");

          // Gate reminder
          if (mapped.length < REQUIRED_SAMPLES) {
            setSummary(
              `Collecting data… (${mapped.length}/${REQUIRED_SAMPLES}) Keep the session running so Insights can fully populate.`
            );
          }
        }

        // optional prediction (only real if backend returns real fields)
        try {
          const pred = await fetchPrediction(uid);
          if (pred && (pred.prediction || pred.message)) {
            setSummary(`🔮 Forecast: ${pred.prediction ?? ""} — ${pred.message ?? ""}`.trim());
          }
        } catch {
          // ignore if offline
        }
      } catch (err) {
        console.log("Insights load error:", err);
        if (!alive) return;
        setSummary("No backend connection — start your FastAPI server to sync data.");
      }
    };

    // run immediately + poll every 10s
    load();
    timer = setInterval(load, 10000);

    // trial status (also refresh every 60s)
    const loadTrial = async () => {
      try {
        const t = await getTrialStatus();
        if (alive) setTrial({ active: t.active, daysLeft: t.daysLeft });
      } catch {
        // ignore
      }
    };
    loadTrial();
    const trialTimer = setInterval(loadTrial, 60000);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (trialTimer) clearInterval(trialTimer);
    };
  }, []);

  const labels =
    history.length > 0 ? history.map((s) => formatShortDate(s.date)) : ["M", "T", "W", "Th", "F", "S", "S"];

  const chartData =
    history.length > 0 ? history.map((s) => computeAshwinIndex(s)) : [0, 0, 0, 0, 0, 0, 0];

  const getColor = (score: number) => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FFC107";
    return "#FF7043";
  };

  const lockedText = (name: string) => `🔒 ${name} (unlock at Silver)`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Weekly Wellness Insights</Text>

        {trial.active && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialText}>
              🟢 Premium Active — {trial.daysLeft} day{trial.daysLeft !== 1 ? "s" : ""} left
            </Text>
          </View>
        )}

        <Text style={styles.subheader}>
          A reflection of your calm, rhythm, and balance through the week.
        </Text>

        {/* CIRCLE */}
        <View style={styles.centerBlock}>
          <Animated.View
            style={[
              styles.circle,
              { backgroundColor: getColor(avgIndex) },
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.circleText}>{avgIndex}</Text>
          </Animated.View>
          <Text style={styles.circleLabel}>Ashwin Weekly Index ({tier})</Text>
        </View>

                {/* CHART */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Weekly Trend</Text>

          <View style={styles.chartRow}>
            <View style={styles.yAxisWrap}>
              <Text style={styles.yAxisLabel} numberOfLines={1}>
                Index Score
              </Text>
            </View>

            <LineChart
              data={{ labels, datasets: [{ data: chartData }] }}
              width={Dimensions.get("window").width - 90}
              height={240}
              fromZero
              segments={5}
              withInnerLines={false}
              verticalLabelRotation={45}
              xLabelsOffset={-6}
              chartConfig={{
                backgroundColor: "#FFFFFF",
                backgroundGradientFrom: "#FFFFFF",
                backgroundGradientTo: "#FFFFFF",
                decimalPlaces: 0,
                color: () => "#1976D2",
                labelColor: () => "#444",
                propsForDots: { r: "4", strokeWidth: "2", stroke: "#2196F3" },
                propsForBackgroundLines: { stroke: "#eee" },
              }}
              bezier
              style={styles.chart}
            />
          </View>

          <Text style={styles.stats}>
            Avg: {avgIndex} | Best: {best} | Low: {low}
          </Text>
        </View>


        {/* ASHWIN AI SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ashwin AI Summary</Text>
          <View style={styles.card}>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        </View>

        {/* PREDICTIVE OUTLOOK */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predictive Outlook</Text>
          {tier === "Bronze" && best < UNLOCK_THRESHOLD ? (
            <Text style={styles.locked}>{lockedText("Predictive Outlook")}</Text>
          ) : (
            <View style={styles.card}>
              <Text style={styles.summaryText}>
                Prediction data will appear here after consistent live sessions.
              </Text>
              <Text style={styles.subnote}>
                (Unlocked at {tier} — keep your index above 75 to keep this.)
              </Text>
            </View>
          )}
        </View>

        {/* NARRATIVE FEEDBACK */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Narrative Feedback</Text>
          {tier === "Gold" || tier === "Ultra" ? (
            <View style={styles.card}>
              <Text style={styles.summaryText}>
                Narrative feedback will unlock as Ashwin learns from your sessions.
              </Text>
            </View>
          ) : (
            <Text style={styles.locked}>🔒 Deeper AI reflection unlocks at Gold</Text>
          )}
        </View>

        {/* EXPLORE WELLNESS STATS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Wellness Stats</Text>
          <View style={styles.cardGrid}>
            {[
              ["🧘 Calm Streak", history.length > 0 ? `${history.length} Days` : "--"],
              ["🌤 Rhythm Flow", avgIndex > 75 ? "Smooth" : "Pending"],
              ["💤 Deep Sleep", "--"],
              ["💚 Recovery Level", avgIndex > 80 ? "Strong" : "Pending"],
            ].map(([label, value]) => (
              <View key={label} style={styles.infoCard}>
                <Text style={styles.cardTitle}>{label}</Text>
                <Text style={styles.cardValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* LEARN & EXPLORE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learn & Explore</Text>
          <View style={styles.cardGrid}>
            {[
              ["🧘 Calm Reset", "Recenter through mindful breathing."],
              ["💤 Deep Rest", "Nightly stillness restores clarity."],
              ["☀️ Morning Flow", "A calm start shapes your day."],
            ].map(([title, desc]) => (
              <View key={title} style={styles.infoCard}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDesc}>{desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* REWARDS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ashwin Rewards</Text>
          <View style={styles.cardGrid}>
            {achievements.map((ach) => {
              const isUnlocked = unlocked.includes(ach.id);
              return (
                <View
                  key={ach.id}
                  style={[
                    styles.trophyCard,
                    { borderColor: ach.color, opacity: isUnlocked ? 1 : 0.35 },
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{ach.emoji}</Text>
                  <Text style={styles.cardTitle}>{ach.title}</Text>
                  <Text style={styles.cardDesc}>{ach.description}</Text>
                  <Text style={styles.rewardTier}>{ach.tier} Reward</Text>
                  {isUnlocked && (
                    <Text style={{ color: ach.color, fontWeight: "700" }}>✅ Unlocked</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footerBlock}>
          <Text style={styles.footerText}>
            Ashwin helps you track calm, rhythm, and rest — staying balanced is your superpower.
          </Text>
          <Text style={styles.footerCopy}>© 2025 Ashwin Wellness</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 120 },
  header: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#000",
    marginBottom: 4,
  },
  subheader: {
    textAlign: "center",
    color: "#555",
    fontSize: 13,
    marginBottom: 20,
  },
  trialBanner: {
    backgroundColor: "#E3F2FD",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  trialText: { color: "#0D47A1", fontSize: 13, fontWeight: "600" },
  centerBlock: { alignItems: "center", marginBottom: 25 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  circleText: { color: "#fff", fontSize: 48, fontWeight: "700" },
  circleLabel: { fontSize: 16, color: "#333", marginTop: 10 },

  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 25,
  },
  chartRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
},

yAxisWrap: {
  width: 36,              // slightly wider so text never clips
  height: 240,
  justifyContent: "center",
  alignItems: "center",
},

yAxisLabel: {
  color: "#666",
  fontSize: 12,
  fontWeight: "500",
  transform: [{ rotate: "-90deg" }],
  width: 240,             // 👈 critical: prevents line wrapping
  textAlign: "center",
},

chart: {
  borderRadius: 12,
  marginVertical: 8,
},

stats: {
  textAlign: "center",
  fontSize: 15,
  color: "#333",
  marginBottom: 10,
},


  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    marginBottom: 10,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryText: { fontSize: 15, color: "#333", lineHeight: 22, textAlign: "center" },

  cardGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  infoCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 15,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: { fontWeight: "600", color: "#333" },
  cardValue: { fontSize: 16, color: "#1976D2", marginTop: 4 },
  cardDesc: { fontSize: 13, color: "#666", marginTop: 2 },

  footerBlock: { alignItems: "center", marginTop: 40 },
  footerText: { textAlign: "center", color: "#555", fontSize: 13, marginBottom: 4, width: "90%" },
  footerCopy: { textAlign: "center", color: "#999", fontSize: 12 },

  locked: { textAlign: "center", color: "#999", fontStyle: "italic" },

  trophyCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  subnote: { textAlign: "center", fontSize: 11, color: "#888", marginTop: 10 },
  rewardTier: { fontSize: 12, color: "#555", marginTop: 6 },
});
