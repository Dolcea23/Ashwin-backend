import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getAllSessions } from "../../utils/sessionManager";

export default function MorningSync() {
  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const all = await getAllSessions();
      if (all.length === 0) return;

      const latest = all[0];
      const savedAt = new Date(latest.savedAt);
      const now = new Date();
      const diffHours = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

      // only show modal if session is within last 8 hours
      if (diffHours <= 8) {
        setSession(latest);
        setVisible(true);
      }
    })();
  }, []);

  if (!visible || !session) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.header}>🌤 Good Morning!</Text>
          <Text style={styles.subtext}>Your latest sleep session summary:</Text>

          <View style={styles.details}>
            <Text>🕒 Start: {session.startTime}</Text>
            <Text>🧠 Avg Index: {session.avg}</Text>
            <Text>💤 Duration: {session.duration} min</Text>
          </View>

          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              setVisible(false);
              router.push("/(tabs)/insights");
            }}
          >
            <Text style={styles.btnText}>View in Insights</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setVisible(false)}
          >
            <Text style={styles.closeText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: { fontSize: 22, fontWeight: "700", color: "#0D47A1", marginBottom: 8 },
  subtext: { fontSize: 14, color: "#555", marginBottom: 15, textAlign: "center" },
  details: { marginBottom: 20 },
  btn: {
    backgroundColor: "#0D47A1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  closeBtn: { marginTop: 10 },
  closeText: { color: "#777" },
});
