import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function Confetti() {
  const router = useRouter();

  useEffect(() => {
    const finalize = async () => {
      await AsyncStorage.setItem("onboardingComplete", "true");
      // short delay for user to see animation
      setTimeout(() => {
        router.replace("/(tabs)/profile");
      }, 2000);
    };

    finalize();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>🎉 Congratulations!</Text>
        <Text style={styles.subtitle}>You’ve completed the Ashwin Wellness onboarding.</Text>
        <Text style={styles.note}>Redirecting to your Profile...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "800", color: "#0D47A1" },
  subtitle: { marginTop: 10, fontSize: 15, color: "#444", textAlign: "center" },
  note: { marginTop: 20, color: "#777", fontSize: 13 },
});
