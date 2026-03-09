// app/(tabs)/live.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import UpgradeModal from "../../components/UpgradeModal";
import { BACKEND } from "../../src/api/apiConfig";

// ------------------------
// DEBUG HELPERS
// ------------------------
const dbg = (...args: any[]) => {
  if (__DEV__) console.log("[LIVE]", ...args);
};

// ------------------------
// HELPERS
// ------------------------
const clamp = (n: number) => Math.max(0, Math.min(100, n));

const colorForScore = (s: number) =>
  s >= 86
    ? "#2196F3"
    : s >= 71
    ? "#4CAF50"
    : s >= 51
    ? "#FFC107"
    : s >= 31
    ? "#FF9800"
    : "#F44336";

const labelForScore = (s: number) =>
  s >= 86
    ? "Balanced"
    : s >= 71
    ? "Stable"
    : s >= 51
    ? "Fatigued"
    : s >= 31
    ? "Drained"
    : "Critical";

const emojiForScore = (s: number) =>
  s >= 86 ? "🧘" : s >= 71 ? "🙂" : s >= 51 ? "😐" : s >= 31 ? "😴" : "🚨";

// ------------------------
// COMPONENT
// ------------------------
export default function Live() {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("No Live Data");
  const [emoji, setEmoji] = useState("⏸️");
  const [timestamp, setTimestamp] = useState("--:--");

  const [countdown, setCountdown] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const [isSleepActive, setIsSleepActive] = useState(false);
  const [sleepStartedAt, setSleepStartedAt] = useState<string | null>(null);

  const [userId, setUserId] = useState<number>(1);

  // Pattern display
  const [patternLabel, setPatternLabel] = useState<string>("--");
  const [patternDesc, setPatternDesc] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const livePollRef = useRef<NodeJS.Timeout | null>(null);

  // ENVIRONMENT SNAPSHOT
  const [envData, setEnvData] = useState({
    avg_temp: undefined as number | undefined,
    avg_light: undefined as number | undefined,
    avg_noise: undefined as number | undefined,
    insights: [] as string[],
  });

  const fetchEnvData = async () => {
    try {
      const res = await fetch(`${BACKEND}/envsync/report/${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setEnvData(data);
    } catch {}
  };

  // ------------------------
  // USER ID LOAD
  // ------------------------
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
      } catch (e) {
        console.warn("Failed to load user id:", e);
      }
    })();
  }, []);

  // Env sync (5 min)
  useEffect(() => {
    if (!userId) return;
    fetchEnvData();
    const interval = setInterval(fetchEnvData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  // ------------------------
  // PULSE ANIMATION
  // ------------------------
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const speed =
      index >= 85 ? 2200 : index >= 70 ? 1800 : index >= 50 ? 1400 : 1000;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: speed / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: speed / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [index, pulse]);

  // ------------------------
  // SAFETY COUNTDOWN (UI + vibration only)
  // ------------------------
  const cancelCountdown = () => {
    Vibration.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(0);
  };

  const startSafetyCountdown = () => {
    if (countdown !== 0) return;
    Vibration.vibrate([300, 300], false);
    setCountdown(30);

    timerRef.current = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          cancelCountdown();
          Alert.alert("Safety Check", "Critical balance detected. Please check on user.");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // ------------------------
  // LIVE INDEX FETCH
  // ------------------------
  const fetchLiveIndex = async () => {
    const url = `${BACKEND}/ashwin/index/${userId}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (data?.index != null) {
        const newIdx = Math.round(clamp(Number(data.index)));
        setIndex(newIdx);
        setStatus(labelForScore(newIdx));
        setEmoji(emojiForScore(newIdx));
        setTimestamp(
          new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );

        // keep your safety behavior
        if (newIdx < 25) startSafetyCountdown();
      }
    } catch (e) {
      dbg("Live poll error", e);
    }
  };

  // ------------------------
  // PATTERN FETCH
  // ------------------------
  const fetchRecent = async () => {
    const url = `${BACKEND}/api/recent?user=${userId}&limit=5`;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const ev = data?.events?.[0];
      if (ev?.label) {
        setPatternLabel(String(ev.label));
        setPatternDesc(ev?.desc ? String(ev.desc) : "");
      }
    } catch (e) {
      dbg("RECENT error", e);
    }
  };

  // ------------------------
  // LIVE POLLING LOOP (every 5s)
  // ------------------------
  useEffect(() => {
    if (!userId) return;

    // immediate pull
    fetchLiveIndex();
    fetchRecent();

    // clear any existing loop
    if (livePollRef.current) {
      clearInterval(livePollRef.current);
      livePollRef.current = null;
    }

    livePollRef.current = setInterval(() => {
      fetchLiveIndex();
      fetchRecent();
    }, 5000);

    return () => {
      if (livePollRef.current) {
        clearInterval(livePollRef.current);
        livePollRef.current = null;
      }
    };
    // IMPORTANT: dependency on userId only keeps polling stable
  }, [userId]);

  // ------------------------
  // SLEEP CONTROLS (backend start/end)
  // ------------------------
  const startSleep = async () => {
    if (isSleepActive) return;

    try {
      const url = `${BACKEND}/sleep/start/${userId}`;
      dbg("START SLEEP ->", url);
      await fetch(url, { method: "POST" });
    } catch (e) {
      dbg("sleep start error", e);
    }

    setIsSleepActive(true);
    setSleepStartedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
    Vibration.vibrate([150, 100, 150]);
  };

  const stopSleep = async () => {
    if (!isSleepActive) return;

    try {
      const url = `${BACKEND}/sleep/end/${userId}`;
      dbg("STOP SLEEP ->", url);
      await fetch(url, { method: "POST" });
    } catch (e) {
      dbg("sleep end error", e);
    }

    setIsSleepActive(false);
    Vibration.vibrate(120);
  };

  const color = colorForScore(index);

  // ------------------------
  // RENDER
  // ------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Live Index</Text>
          <Text style={styles.sub}>Mind • Rhythm • Stress patterns in real time</Text>
        </View>

        <View style={styles.centerArea}>
          <Animated.View
            style={[styles.circle, { backgroundColor: color, transform: [{ scale: pulse }] }]}
          >
            <Text style={styles.circleText}>{index}</Text>
          </Animated.View>

          <Text style={{ color, fontSize: 13 }}>
            {index > 0 ? "● Live Feed Active" : "Waiting for Connection"}
          </Text>

          <Text style={styles.state}>
            {emoji} {status}
          </Text>

          <Text style={styles.timestamp}>Last updated: {timestamp}</Text>

          {/* Pattern */}
          <Text style={{ fontSize: 13, marginTop: 4, color: "#333" }}>
            Pattern: {patternLabel}
          </Text>
          {!!patternDesc && (
            <Text style={{ fontSize: 12, marginTop: 2, color: "#666", textAlign: "center", paddingHorizontal: 18 }}>
              {patternDesc}
            </Text>
          )}

          {/* Bar */}
          <View style={styles.barBlock}>
            <View style={styles.barBase}>
              <View style={[styles.barFill, { backgroundColor: color, width: `${index}%` }]} />
            </View>
            <View style={styles.barLabels}>
              <Text>Low</Text>
              <Text>Balanced</Text>
              <Text>Optimal</Text>
            </View>
          </View>

          {/* Environment */}
          <View style={styles.envBox}>
            <Text style={styles.envTitle}>Environment Snapshot</Text>
            <View style={styles.envInner}>
              <Text style={styles.envText}>
                🌡️ {envData.avg_temp ?? "--"}°F • 💡 {envData.avg_light ?? "--"} lx • 🔊 {envData.avg_noise ?? "--"} dB
              </Text>
              {envData.insights?.map((i, k) => (
                <Text key={k} style={styles.envInsight}>
                  {i}
                </Text>
              ))}
            </View>
          </View>

          {/* Sleep */}
          <View style={styles.sleepRow}>
            {!isSleepActive ? (
              <TouchableOpacity onPress={startSleep} style={[styles.sleepBtn, styles.sleepStart]}>
                <Text style={styles.sleepText}>Start Sleep Session</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text style={styles.sleepStatus}>🛌 Sleeping… Started at {sleepStartedAt}</Text>
                <TouchableOpacity onPress={stopSleep} style={[styles.sleepBtn, styles.sleepStop]}>
                  <Text style={styles.sleepText}>Stop Sleep Session</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Safety */}
          {countdown > 0 && (
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>Safety Check</Text>
              <Text style={styles.alertMsg}>
                Notifying in {countdown}s unless canceled.
              </Text>
              <TouchableOpacity onPress={cancelCountdown} style={styles.alertCancel}>
                <Text style={styles.alertCancelText}>I'm OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.bottomMsg}>Ashwin keeps your balance steady every moment.</Text>
        <Text style={styles.footer}>© 2025 Ashwin Wellness • Live Balance</Text>
      </ScrollView>

      <UpgradeModal visible={showModal} onClose={() => setShowModal(false)} />
    </SafeAreaView>
  );
}

// ------------------------
// STYLES
// ------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, paddingBottom: 100 },
  headerBlock: { alignItems: "center", marginTop: 30 },
  header: { fontSize: 22, fontWeight: "700", color: "#111" },
  sub: { fontSize: 13, color: "#555", marginTop: 8 },
  centerArea: { alignItems: "center", marginTop: 30 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  circleText: { fontSize: 48, color: "#fff", fontWeight: "700" },
  state: { fontSize: 16, color: "#333", marginTop: 10 },
  timestamp: { fontSize: 12, color: "#666", marginBottom: 18 },

  barBlock: { width: "100%", alignItems: "center" },
  barBase: { width: "90%", height: 10, borderRadius: 6, backgroundColor: "#E0E0E0" },
  barFill: { height: "100%", borderRadius: 6 },
  barLabels: { flexDirection: "row", justifyContent: "space-between", width: "90%", marginTop: 6 },

  envBox: { width: "90%", marginTop: 30 },
  envTitle: { fontWeight: "700", textAlign: "center", color: "#0D47A1" },
  envInner: { backgroundColor: "#E3F2FD", borderRadius: 10, padding: 10, marginTop: 8 },
  envText: { fontSize: 13, color: "#333", textAlign: "center" },
  envInsight: { fontSize: 12, color: "#555", textAlign: "center" },

  sleepRow: { width: "100%", alignItems: "center", marginTop: 40 },
  sleepBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, minWidth: "70%" },
  sleepStart: { backgroundColor: "#0D47A1" },
  sleepStop: { backgroundColor: "#C62828", marginTop: 8 },
  sleepText: { color: "#fff", fontWeight: "700" },
  sleepStatus: { color: "#333", fontSize: 13, marginBottom: 6 },

  alertBox: {
    backgroundColor: "#FFF4E5",
    borderColor: "#FFA726",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    width: "90%",
    marginTop: 10,
  },
  alertTitle: { color: "#E65100", fontWeight: "700", fontSize: 16, textAlign: "center" },
  alertMsg: { fontSize: 14, color: "#333", textAlign: "center" },
  alertCancel: { marginTop: 10, backgroundColor: "#1976D2", paddingVertical: 10, borderRadius: 8 },
  alertCancelText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  bottomMsg: { textAlign: "center", color: "#666", marginTop: 60, marginBottom: 4 },
  footer: { textAlign: "center", color: "#999", fontSize: 12 },
});
useEffect(() => {
  console.log("BACKEND (runtime) =", BACKEND);
}, []);
