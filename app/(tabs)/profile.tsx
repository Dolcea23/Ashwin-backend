import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getEmergencyContact, setEmergencyContact } from "../../utils/storage";

export default function Profile() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [sleepGoal, setSleepGoal] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [notifications, setNotifications] = useState(true);
  const [autoConnect, setAutoConnect] = useState(true);

  const [trialActive, setTrialActive] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  // "Connection" state (UI + flag)
  const [btConnected, setBtConnected] = useState(false);
  const [btConnecting, setBtConnecting] = useState(false);
  const [btDeviceName] = useState("Ashwin Pillow");

  const router = useRouter();

  useEffect(() => {
    loadProfile();
    checkTrial();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem("ASHWIN_PROFILE");
      if (stored) {
        const p = JSON.parse(stored);
        setName(p.name || "");
        setAge(p.age || "");
        setGender(p.gender || "");
        setHeight(p.height || "");
        setWeight(p.weight || "");
        setSleepGoal(p.sleepGoal || "");
        setNotifications(p.notifications ?? true);
        setAutoConnect(p.autoConnect ?? true);
      }

      const c = await getEmergencyContact();
      if (c) {
        setContactName(c.name || "");
        setContactPhone(c.phone || "");
      }

      const bt = await AsyncStorage.getItem("ASHWIN_BT_CONNECTED");
      if (bt === "true") setBtConnected(true);
    } catch (e) {
      console.warn("Profile load error:", e);
    }
  };

  const checkTrial = async () => {
    const active = await AsyncStorage.getItem("ASHWIN_TRIAL_ACTIVE");
    const start = await AsyncStorage.getItem("ASHWIN_TRIAL_START");

    if (active && start) {
      const startDate = new Date(start);
      const diffDays = Math.floor(
        (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remaining = 7 - diffDays;

      if (remaining > 0) {
        setTrialActive(true);
        setDaysLeft(remaining);
      } else {
        setTrialActive(false);
        setDaysLeft(0);
        await AsyncStorage.removeItem("ASHWIN_TRIAL_ACTIVE");
        Alert.alert("Trial Ended", "Your 7-day free trial has expired.");
      }
    } else {
      setTrialActive(false);
    }
  };

  const startTrial = async () => {
    await AsyncStorage.setItem("ASHWIN_TRIAL_ACTIVE", "true");
    await AsyncStorage.setItem("ASHWIN_TRIAL_START", new Date().toISOString());
    setTrialActive(true);
    setDaysLeft(7);
    Alert.alert("🎉 Trial Started", "You now have 7 days of Ashwin Premium!");
  };

  const saveProfile = async () => {
    const profile = {
      name,
      age,
      gender,
      height,
      weight,
      sleepGoal,
      notifications,
      autoConnect,
    };
    await AsyncStorage.setItem("ASHWIN_PROFILE", JSON.stringify(profile));
    await setEmergencyContact({ name: contactName, phone: contactPhone });
    Alert.alert("Saved", "Profile updated successfully.");
  };

  // "Connect to Pillow" is now just marking you're ready & saving a flag
  const handleConnectPillow = async () => {
    if (btConnecting) return;
    setBtConnecting(true);
    try {
      // In Wi-Fi mode, ESP32 talks to backend directly.
      // Here we just mark "ready" so the app knows user is on the pillow.
      setBtConnected(true);
      await AsyncStorage.setItem("ASHWIN_BT_CONNECTED", "true");
      Alert.alert(
        "Pillow Ready",
        "Ashwin Pillow is marked as connected.\nMake sure the board is powered and Wi-Fi is on."
      );
    } finally {
      setBtConnecting(false);
    }
  };

  const handleDisconnectPillow = async () => {
    setBtConnected(false);
    await AsyncStorage.setItem("ASHWIN_BT_CONNECTED", "false");
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "ASHWIN_USER",
            "ASHWIN_PROFILE",
            "ASHWIN_TRIAL_ACTIVE",
            "ASHWIN_TRIAL_START",
            "ASHWIN_BT_CONNECTED",
            "isRegistered",
            "onboardingComplete",
          ]);

          router.replace("/signin");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>
          {name ? `${name}'s Profile` : "Your Profile"}
        </Text>
        <Text style={styles.subheader}>
          Personalized for balance, growth, and wellness.
        </Text>

        {/* ---- Pillow Connection ---- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pillow Connection</Text>

          <Text
            style={{
              marginBottom: 8,
              color: btConnected ? "#2E7D32" : "#C62828",
              fontWeight: "600",
            }}
          >
            Status: {btConnected ? "🟢 Ready" : "🔴 Not Ready"}
          </Text>

          <Text style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>
            Device: {btDeviceName}
          </Text>

          {btConnected ? (
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: "#B71C1C" }]}
              onPress={handleDisconnectPillow}
            >
              <Text style={styles.connectText}>Mark as Not Connected</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleConnectPillow}
              disabled={btConnecting}
            >
              <Text style={styles.connectText}>
                {btConnecting ? "Setting..." : "Connect to Pillow"}
              </Text>
            </TouchableOpacity>
          )}

          <SwitchRow
            label="Auto-Reconnect (Wi-Fi Ready)"
            value={autoConnect}
            onValueChange={setAutoConnect}
          />
        </View>

        {/* ---- Personal Info ---- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Input label="Name" value={name} onChangeText={setName} />
          <Input
            label="Age"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />
          <Input label="Gender" value={gender} onChangeText={setGender} />
          <Input
            label="Height (in)"
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
          />
          <Input
            label="Weight (lbs)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
          />
          <Input
            label="Sleep Goal (hours)"
            value={sleepGoal}
            onChangeText={setSleepGoal}
            keyboardType="numeric"
          />
        </View>

        {/* ---- Emergency Contact ---- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <Input
            label="Contact Name"
            value={contactName}
            onChangeText={setContactName}
          />
          <Input
            label="Contact Phone"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* ---- Preferences ---- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <SwitchRow
            label="Enable Notifications"
            value={notifications}
            onValueChange={setNotifications}
          />
        </View>

        {/* ---- Save Button ---- */}
        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>

        {/* ---- Trial Section ---- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ashwin Premium</Text>
          {trialActive ? (
            <>
              <Text style={styles.trialText}>
                🟢 Trial Active — {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
              </Text>
              <Text style={styles.priceText}>
                After trial: $9.99/month or $100/year
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.trialText}>
                Enjoy <Text style={{ fontWeight: "700" }}>7-Day Free Trial</Text>{" "}
                — deeper AI insights & feedback loops.
              </Text>
              <TouchableOpacity style={styles.trialBtn} onPress={startTrial}>
                <Text style={styles.trialBtnText}>Start 7-Day Trial</Text>
              </TouchableOpacity>
              <Text style={styles.priceText}>$9.99/month • $100/year</Text>
            </>
          )}
        </View>

        {/* ---- Logout ---- */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 30 }}>
          <Text style={styles.footerLine}>
            Designed for Reflection, not Diagnosis.
          </Text>
          <Text style={styles.footerBrand}>© 2025 Ashwin Wellness</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Input = ({ label, ...props }: any) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      {...props}
      style={styles.input}
      placeholder={label}
      placeholderTextColor="#aaa"
    />
  </View>
);

const SwitchRow = ({ label, value, onValueChange }: any) => (
  <View style={styles.switchRow}>
    <Text style={styles.switchLabel}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { padding: 20, paddingBottom: 120 },
  header: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: "#0D47A1",
  },
  subheader: {
    textAlign: "center",
    color: "#555",
    fontSize: 13,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0D47A1",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { fontSize: 13, color: "#444", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#222",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  switchLabel: { fontSize: 14, color: "#333" },
  saveBtn: {
    backgroundColor: "#1877F2",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 25,
  },
  saveText: { color: "#fff", fontWeight: "700" },
  connectBtn: {
    backgroundColor: "#1565C0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  connectText: { color: "#fff", fontWeight: "700" },
  trialText: { fontSize: 14, color: "#333", marginBottom: 10 },
  trialBtn: {
    backgroundColor: "#1877F2",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  trialBtnText: { color: "#fff", fontWeight: "700" },
  priceText: { textAlign: "center", fontSize: 12, color: "#666", marginTop: 8 },
  logoutBtn: {
    backgroundColor: "#E53935",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  logoutText: { color: "#fff", fontWeight: "700" },
  footerLine: { textAlign: "center", color: "#777", fontSize: 12 },
  footerBrand: {
    textAlign: "center",
    color: "#333",
    fontSize: 12,
    marginTop: 2,
  },
});
