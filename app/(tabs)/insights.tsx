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
import { fetchPrediction } from "../../src/api/predictiveAPI"; // backend AI
import { achievements, evaluateAchievements } from "../../src/utils/rewardSystem";
import { getTrialStatus } from "../../utils/trialManager";

type Session = {
  date: string;
  eegCalmness: number;
  ecgRhythm: number;
  edaStress: number;
};

export default function Insights() {
  const [history, setHistory] = useState<Session[]>([]);
  const [avgIndex, setAvgIndex] = useState(0);
  const [best, setBest] = useState(0);
  const [low, setLow] = useState(0);
  const [summary, setSummary] = useState(
    "Reviewing your week of balance and clarity..."
  );
  const [trial, setTrial] = useState<{ active: boolean; daysLeft: number }>({
    active: false,
    daysLeft: 0,
  });

  // rewards
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [tier, setTier] = useState<"Bronze" | "Silver" | "Gold" | "Ultra">(
    "Bronze"
  );

  // pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const computeAshwinIndex = (s: Session) => {
    const calm = s.eegCalmness ?? 60;
    const rhythm = s.ecgRhythm ?? 70;
    const stress = 100 - (s.edaStress ?? 40);
    return Math.round(0.4 * calm + 0.4 * rhythm + 0.2 * stress);
  };

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    // 1) mock weekly sessions (your original data)
    const sample: Session[] = [
      { date: "Mon", eegCalmness: 72, ecgRhythm: 75, edaStress: 28 },
      { date: "Tue", eegCalmness: 78, ecgRhythm: 80, edaStress: 22 },
      { date: "Wed", eegCalmness: 85, ecgRhythm: 82, edaStress: 20 },
      { date: "Thu", eegCalmness: 80, ecgRhythm: 79, edaStress: 25 },
      { date: "Fri", eegCalmness: 88, ecgRhythm: 85, edaStress: 18 },
      { date: "Sat", eegCalmness: 90, ecgRhythm: 88, edaStress: 15 },
      { date: "Sun", eegCalmness: 84, ecgRhythm: 83, edaStress: 20 },
    ];
    setHistory(sample);

    // 2) score math
    const scores = sample.map((s) => computeAshwinIndex(s));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    setAvgIndex(Math.round(avg));
    setBest(Math.max(...scores));
    setLow(Math.min(...scores));

    // 3) OG summary (your texts)
    if (avg >= 80) {
      setSummary(
        "You’ve found a strong flow this week — calm, rhythm, and focus are balanced."
      );
    } else if (avg >= 60) {
      setSummary(
        "Your energy stayed steady with minor dips — keep breathing, keep moving forward."
      );
    } else {
      setSummary(
        "Your rhythm fluctuated. Prioritize sleep and calm moments to reset your flow."
      );
    }

    // 4) reward logic
    const progress = {
      avg,
      streak: 14,
      sessions: sample.length,
    };
    const { allUnlocked } = evaluateAchievements(progress, []);
    setUnlocked(allUnlocked);

    // 5) tier
    if (avg >= 88) setTier("Ultra");
    else if (avg >= 82) setTier("Gold");
    else if (avg >= 75) setTier("Silver");
    else setTier("Bronze");

    if (allUnlocked.length > 0) triggerPulse();

    // 6) trial status
    (async () => {
      const t = await getTrialStatus();
      setTrial({ active: t.active, daysLeft: t.daysLeft });
    })();

    // 7) pull prediction from backend (if running)
    (async () => {
      try {
        const res = await fetchPrediction(1);
        if (res && res.prediction) {
          setSummary(
            `🔮 ${res.message}\nTrend: ${res.trend}\nForecasted Index: ${res.prediction}`
          );
        }
      } catch (e) {
        // silent if backend not running
      }
    })();
  }, []);

  const labels = ["M", "T", "W", "Th", "F", "S", "S"];
  const chartData =
    history.length > 0
      ? history.map((s) => computeAshwinIndex(s))
      : [60, 62, 64, 68, 70, 72, 74];

  const getColor = (score: number) => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FFC107";
    return "#FF7043";
  };

  const lockedText = (name: string) => `🔒 ${name} (unlock at Silver)`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* HEADER */}
        <Text style={styles.header}>Weekly Wellness Insights</Text>

        {/* Trial banner */}
        {trial.active && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialText}>
              🟢 Premium Active — {trial.daysLeft} day
              {trial.daysLeft !== 1 ? "s" : ""} left
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
          <LineChart
            data={{
              labels,
              datasets: [{ data: chartData }],
            }}
            width={Dimensions.get("window").width - 40}
            height={220}
            chartConfig={{
              backgroundColor: "#FFFFFF",
              backgroundGradientFrom: "#FFFFFF",
              backgroundGradientTo: "#FFFFFF",
              decimalPlaces: 0,
              color: () => "#1976D2",
              labelColor: () => "#444",
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: "#2196F3",
              },
            }}
            bezier
            style={styles.chart}
          />
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

        {/* PREDICTIVE OUTLOOK — gated */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predictive Outlook</Text>
          {tier === "Bronze" ? (
            <Text style={styles.locked}>{lockedText("Predictive Outlook")}</Text>
          ) : (
            <View style={styles.card}>
              <Text style={styles.summaryText}>
                Based on this week’s recovery signal, your calm window is strongest between 9–11 AM.
                Schedule focus work there.
              </Text>
              <Text style={styles.subnote}>
                (Unlocked at {tier} — keep your index above 75 to keep this.)
              </Text>
            </View>
          )}
        </View>

        {/* NARRATIVE FEEDBACK — gated */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Narrative Feedback</Text>
          {tier === "Gold" || tier === "Ultra" ? (
            <View style={styles.card}>
              <Text style={styles.summaryText}>
                Your system is learning your calm signature. Spikes are resolving faster than at the
                start of the week — this is what stabilization looks like.
              </Text>
            </View>
          ) : (
            <Text style={styles.locked}>🔒 Deeper AI reflection unlocks at Gold</Text>
          )}
        </View>

        {/* EXPLORE WELLNESS STATS — your original block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Wellness Stats</Text>
          <View style={styles.cardGrid}>
            {[
              ["🧘 Calm Streak", "4 Days"],
              ["🌤 Rhythm Flow", avgIndex > 75 ? "Smooth" : "Moderate"],
              ["💤 Deep Sleep", "7.4 hrs"],
              ["💚 Recovery Level", avgIndex > 80 ? "Strong" : "Building"],
            ].map(([label, value]) => (
              <View key={label} style={styles.infoCard}>
                <Text style={styles.cardTitle}>{label}</Text>
                <Text style={styles.cardValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* LEARN & EXPLORE — your original block */}
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
                    {
                      borderColor: ach.color,
                      opacity: isUnlocked ? 1 : 0.35,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>{ach.emoji}</Text>
                  <Text style={styles.cardTitle}>{ach.title}</Text>
                  <Text style={styles.cardDesc}>{ach.description}</Text>
                  <Text style={styles.rewardTier}>{ach.tier} Reward</Text>
                  {isUnlocked && (
                    <Text style={{ color: ach.color, fontWeight: "700" }}>
                      ✅ Unlocked
                    </Text>
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
  chart: { borderRadius: 12, marginVertical: 8 },
  stats: { textAlign: "center", fontSize: 15, color: "#333", marginBottom: 10 },
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
