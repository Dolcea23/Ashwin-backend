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

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      const user = await AsyncStorage.getItem("ASHWIN_USER");
      if (!user) {
        Alert.alert("Account not found", "Please sign up first.");
        router.replace("/signup");
        return;
      }

      // Mock authentication
      await AsyncStorage.setItem("isLoggedOut", "false");
      await AsyncStorage.setItem("onboardingComplete", "true");

      router.replace("/(tabs)/home");
    } catch (err) {
      Alert.alert("Error", "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome Back</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={onSignIn}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => router.push("/(auth)/forgotpassword")}
        >
          <Text style={styles.forgotText}>Forgot your password?</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Don’t have an account? <Link href="/signup">Sign Up</Link>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0D47A1",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  btn: {
    backgroundColor: "#0D47A1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  forgotLink: { marginTop: 10, alignSelf: "center" },
  forgotText: { color: "#0D47A1", fontWeight: "600" },
  footer: { textAlign: "center", color: "#555", marginTop: 15 },
});
