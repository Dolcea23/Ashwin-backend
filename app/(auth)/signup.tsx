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




export default function SignUp() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !pin.trim()) {
      Alert.alert("Missing info", "Fill in name, email, and 4-digit code.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      Alert.alert("4-Digit Code", "Your code must be exactly 4 numbers.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${BACKEND}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  // backend uses "name" as login identifier (email)
  name: email.trim(),
  pin: pin.trim(),
  display_name: fullName.trim(),
}),

      });

      if (!res.ok) {
        let msg = "Sign up failed. Please try again.";

        try {
          const body = await res.json();
          console.log("Signup error body:", body);

          if (res.status === 400 && body?.error === "User already exists") {
            msg = "This email is already registered. Please sign in instead.";
          } else if (body?.error) {
            msg = body.error;
          }
        } catch (e) {
          console.log("Signup error parse failed:", e);
        }

        Alert.alert("Sign Up Failed", msg);
        return;
      }

      const data = await res.json();
      console.log("Signup success:", data);

      const userPayload = {
        userId: data.id,
        name: fullName.trim(),
        email: email.trim(),
        sessionId: data.session_id,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.multiSet([
        ["isRegistered", "true"],
        ["isLoggedOut", "false"],
        ["onboardingComplete", "false"],
        ["ASHWIN_USER", JSON.stringify(userPayload)],
        ["ASHWIN_USER_ID", String(data.id)],
      ]);

      // tiny delay
      await new Promise((r) => setTimeout(r, 150));

      router.replace("/questionnaire");
    } catch (e) {
      console.error("Sign Up Failed (network):", e);
      Alert.alert(
        "Network error",
        "Could not reach the Ashwin server. Make sure the backend is running."
      );
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            One code, one pillow, one live wellness stream.
          </Text>

          {/* Full Name */}
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Jordan Angel"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* Email */}
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

          {/* 4-Digit Code */}
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
            <Text style={styles.helper}>
              Use this code to sign back in from any phone.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.btn}
            onPress={onSignUp}
            disabled={loading}
          >
            <Text style={styles.btnText}>
              {loading ? "Creating..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Already have an account? <Link href="/signin">Sign In</Link>
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
  helper: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
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
