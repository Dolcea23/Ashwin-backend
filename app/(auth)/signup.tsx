import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      // Save session flags + user
      await AsyncStorage.multiSet([
        ["isRegistered", "true"],
        ["isLoggedOut", "false"],
        ["onboardingComplete", "false"],
        ["ASHWIN_USER", JSON.stringify({ email, createdAt: new Date().toISOString() })],
      ]);

      // Give storage a moment to persist (prevents rare loops)
      await new Promise((r) => setTimeout(r, 250));

      // 👉 Go to the next step of onboarding
      // If you want the “Get Started” screen first, use "/welcome"
      // If you want to jump straight to questions, use "/questionnaire"
      router.replace("/questionnaire");
      // router.replace("/welcome");
    } catch (e) {
      console.error("Sign Up Failed:", e);
      Alert.alert("Sign Up Failed", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Create your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={onSignUp} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Creating..." : "Sign Up"}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Already have an account? <Link href="/signin">Sign In</Link>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#0D47A1", textAlign: "center", marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  btn: {
    backgroundColor: "#1877F2",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  footer: { textAlign: "center", color: "#555", marginTop: 15 },
});
