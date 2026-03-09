import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ------------------------
// BACKEND CONFIG UPDATED
// ------------------------
import { BACKEND } from "../../src/api/apiConfig";




export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!email.trim() || !pin.trim()) {
      Alert.alert("Missing info", "Enter email and 4-digit code.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      Alert.alert("4-Digit Code", "Your code must be exactly 4 numbers.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${BACKEND}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: email.trim(), // backend "name" = email
          pin: pin.trim(),
        }),
      });

      if (!res.ok) {
        console.log("Login error:", await res.text());
        throw new Error("Invalid login.");
      }

      const data = await res.json();
      const userPayload = {
        userId: data.id,
        name: email.trim(),
        email: email.trim(),
        sessionId: data.session_id,
        lastLogin: new Date().toISOString(),
      };

      await AsyncStorage.multiSet([
        ["isRegistered", "true"],
        ["isLoggedOut", "false"],
        ["ASHWIN_USER", JSON.stringify(userPayload)],
        ["ASHWIN_USER_ID", String(data.id)],
      ]);

      // If onboarding already completed, go to main app
      const ob = await AsyncStorage.getItem("onboardingComplete");
      if (ob === "true") {
        router.replace("/(tabs)/live");
      } else {
        router.replace("/questionnaire");
      }
    } catch (e) {
      console.error("Sign In Failed:", e);
      Alert.alert("Sign In Failed", "Check your email/code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.logo}>Ashwin Wellness</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Enter your email and 4-digit code to continue.
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>4-Digit Access Code</Text>
            <TextInput
              style={styles.input}
              placeholder="••••"
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^\d]/g, "").slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.btn}
            onPress={onSignIn}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            New to Ashwin? <Link href="/signup">Create Account</Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFF" },
  container: {
    flex: 1,
    padding: 22,
    justifyContent: "center",
  },
  logo: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0D47A1",
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
  },
  fieldBlock: { marginBottom: 14 },
  label: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 4,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },
  btn: {
    backgroundColor: "#0D47A1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 18,
    fontSize: 13,
  },
});
