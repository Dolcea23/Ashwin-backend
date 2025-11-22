import * as SMS from "expo-sms";
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
import { connectToDevice, disconnectDevice } from "../../utils/bleService";
import { getEmergencyContact } from "../../utils/storage";
import {
  getTrialStatus,
  markTrialAlertShown,
  shouldShowTrialAlert,
} from "../../utils/trialManager";

// ---------- Helpers ----------
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const colorForScore = (s: number) =>
  s >= 86 ? "#2196F3" : s >= 71 ? "#4CAF50" : s >= 51 ? "#FFC107" : s >= 31 ? "#FF9800" : "#F44336";
const labelForScore = (s: number) =>
  s >= 86 ? "Balanced" : s >= 71 ? "Stable" : s >= 51 ? "Fatigued" : s >= 31 ? "Drained" : "Critical";
const emojiForScore = (s: number) =>
  s >= 86 ? "🧘" : s >= 71 ? "🙂" : s >= 51 ? "😐" : s >= 31 ? "😴" : "🚨";

const computeAshwinLiveIndex = ({
  eegCalmness,
  ecgRhythm,
  edaStress,
}: {
  eegCalmness?: number;
  ecgRhythm?: number;
  edaStress?: number;
}) => {
  const calm = clamp(eegCalmness ?? 60);
  const rhythm = clamp(ecgRhythm ?? 70);
  const stress = clamp(edaStress ?? 40);
  const stressAdjusted = 100 - stress;
  return Math.round(clamp(0.4 * calm + 0.4 * rhythm + 0.2 * stressAdjusted));
};

// ---------- Component ----------
export default function Live() {
  const [index, setIndex] = useState(75);
  const [status, setStatus] = useState(labelForScore(75));
  const [emoji, setEmoji] = useState(emojiForScore(75));
  const [timestamp, setTimestamp] = useState("--:--");
  const [contact, setContact] = useState<{ name?: string; phone?: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [trial, setTrial] = useState<{ active: boolean; daysLeft: number; expired?: boolean }>({
    active: false,
    daysLeft: 0,
    expired: false,
  });
  const [showModal, setShowModal] = useState(false);
  const [isSleepActive, setIsSleepActive] = useState(false);
  const [sleepStartedAt, setSleepStartedAt] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 💓 Pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const speed = index >= 85 ? 2200 : index >= 70 ? 1800 : index >= 50 ? 1400 : 1000;
    Animated.loop(
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
    ).start();
  }, [index]);

  // Load contact + trial status
  useEffect(() => {
    (async () => {
      const c = await getEmergencyContact();
      if (c) setContact(c);

      const t = await getTrialStatus();
      setTrial(t);

      if (t.expired) {
        const canShow = await shouldShowTrialAlert();
        if (canShow) {
          Alert.alert(
            "Trial Ended",
            "Your 7-day trial has ended. Upgrade to continue using Live Index.",
            [
              { text: "Later", style: "cancel" },
              { text: "Upgrade", onPress: () => setShowModal(true) },
            ]
          );
          await markTrialAlertShown();
        }
      }
    })();
  }, []);

  // Connect BLE
  useEffect(() => {
    connectToDevice((data: any) => {
      const eeg = data?.eegCalmness ?? 60;
      const ecg = data?.ecgRhythm ?? 70;
      const eda = data?.edaStress ?? 40;

      const newIndex = computeAshwinLiveIndex({ eegCalmness: eeg, ecgRhythm: ecg, edaStress: eda });
      setIndex(newIndex);
      setStatus(labelForScore(newIndex));
      setEmoji(emojiForScore(newIndex));
      setTimestamp(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

      if (newIndex < 25 && trial.active) startSafetyCountdown();
    });

    return () => {
      disconnectDevice();
      cancelCountdown();
    };
  }, [trial.active]);

  const startSafetyCountdown = () => {
    if (countdown !== 0) return;
    Vibration.vibrate([300, 300], false);
    setCountdown(30);
    timerRef.current = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          cancelCountdown();
          notifyContact();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    Vibration.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(0);
  };

  const notifyContact = async () => {
    if (!contact?.phone) return;
    const available = await SMS.isAvailableAsync();
    const msg = `Ashwin Wellness Notice:\nCritical balance pattern detected.\nLive Index: ${index}/100.\nPlease check on ${contact?.name || "user"}.`;
    if (available) await SMS.sendSMSAsync([contact.phone], msg);
    else Alert.alert("Notice", msg);
  };

  // Sleep session controls
  const startSleep = () => {
    if (isSleepActive) return;
    setIsSleepActive(true);
    setSleepStartedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    Vibration.vibrate([150, 100, 150]);
  };

  const stopSleep = () => {
    if (!isSleepActive) return;
    setIsSleepActive(false);
    Vibration.vibrate(120);
  };

  const color = colorForScore(index);

  // ---------- Render ----------
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <Text style={styles.header}>Live Index</Text>
          {trial.active && (
            <View style={styles.trialBanner}>
              <Text style={styles.trialText}>
                🟢 Premium Active — {trial.daysLeft} day{trial.daysLeft !== 1 ? "s" : ""} left
              </Text>
            </View>
          )}
          <Text style={styles.subheader}>Mind • Rhythm • Stress patterns in real time</Text>
        </View>

        <View style={styles.centerArea}>
          {/* 💓 Pulsing Circle */}
          <Animated.View
            style={[
              styles.circle,
              {
                backgroundColor: color,
                transform: [{ scale: pulse }],
                shadowColor: color,
                shadowOpacity: 0.3,
                shadowRadius: 15,
              },
            ]}
          >
            <Text style={styles.circleText}>{index}</Text>
          </Animated.View>

          <Text style={{ color: color, fontSize: 13, marginBottom: 6 }}>
            ● Live Feed Active
          </Text>

          <Text style={styles.stateText}>
            {emoji} {status}
          </Text>
          <Text style={styles.timestamp}>Last updated: {timestamp}</Text>

          {/* Dynamic bar */}
          <View style={styles.barContainer}>
            <View style={styles.barBase}>
              <View style={[styles.barFill, { backgroundColor: color, width: `${index}%` }]} />
            </View>
            <View style={styles.barLabels}>
              <Text style={styles.label}>Low</Text>
              <Text style={styles.label}>Balanced</Text>
              <Text style={styles.label}>Optimal</Text>
            </View>
          </View>

          {/* Sleep Controls */}
          <View style={styles.sleepRow}>
            {!isSleepActive ? (
              <TouchableOpacity onPress={startSleep} style={[styles.sleepBtn, styles.sleepStart]}>
                <Text style={styles.sleepBtnText}>Start Sleep Session</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: "center", width: "100%" }}>
                <Text style={styles.sleepStatus}>
                  🛌 Sleeping… Started at {sleepStartedAt || "--:--"}
                </Text>
                <TouchableOpacity onPress={stopSleep} style={[styles.sleepBtn, styles.sleepStop]}>
                  <Text style={styles.sleepBtnText}>Stop Sleep Session</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Safety countdown */}
          {countdown > 0 && (
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>Safety Check</Text>
              <Text style={styles.alertText}>
                Notifying your saved contact in {countdown}s unless canceled.
              </Text>
              <TouchableOpacity onPress={cancelCountdown} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>I'm OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomMessage}>
            Ashwin keeps your balance steady in every moment.
          </Text>
          <Text style={styles.footer}>© 2025 Ashwin Wellness • Live Balance</Text>
        </View>
      </ScrollView>

      <UpgradeModal visible={showModal} onClose={() => setShowModal(false)} />
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingBottom: 100 },
  headerBlock: { alignItems: "center", marginTop: 30 },
  header: { fontSize: 22, fontWeight: "700", color: "#111" },
  trialBanner: {
    backgroundColor: "#E3F2FD",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  trialText: { color: "#0D47A1", fontSize: 13, fontWeight: "600" },
  subheader: { fontSize: 13, color: "#555", textAlign: "center", marginTop: 8, marginBottom: 20 },
  centerArea: { alignItems: "center", marginTop: 30 },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  circleText: { fontSize: 48, color: "#fff", fontWeight: "700" },
  stateText: { fontSize: 16, color: "#333", textAlign: "center", marginTop: 10 },
  timestamp: { fontSize: 12, color: "#666", textAlign: "center", marginBottom: 18 },
  barContainer: { width: "100%", alignItems: "center", marginBottom: 10 },
  barBase: { width: "90%", height: 10, borderRadius: 6, backgroundColor: "#E0E0E0", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  barLabels: { flexDirection: "row", justifyContent: "space-between", width: "90%", marginTop: 6 },
  sleepRow: { width: "100%", alignItems: "center", marginTop: 40 },
  sleepBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", minWidth: "70%" },
  sleepStart: { backgroundColor: "#0D47A1" },
  sleepStop: { backgroundColor: "#C62828", marginTop: 8 },
  sleepBtnText: { color: "#fff", fontWeight: "700" },
  sleepStatus: { color: "#333", fontSize: 13, marginBottom: 6 },
  label: { fontSize: 11, color: "#777" },
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
  alertText: { fontSize: 14, color: "#333", textAlign: "center" },
  cancelBtn: { marginTop: 10, backgroundColor: "#1976D2", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  cancelText: { color: "#fff", fontWeight: "700" },
  bottomSection: { alignItems: "center", marginTop: 60 },
  bottomMessage: { textAlign: "center", fontSize: 13, color: "#666", marginBottom: 4 },
  footer: { textAlign: "center", color: "#999", fontSize: 12 },
});
