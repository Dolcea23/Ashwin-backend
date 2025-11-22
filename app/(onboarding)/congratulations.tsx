import { useRouter } from "expo-router";
import React from "react";
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Congratulations() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Image
          source={require("../../assets/onboarding3.png")}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Congratulations 🎉</Text>
        <Text style={styles.subtitle}>
          You’ve completed your Ashwin Wellness onboarding!  
          Your personalized insights are now ready to guide your next step.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Text style={styles.buttonText}>Enter My Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFF" },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  image: {
    width: "85%",
    height: 230,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0D47A1",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginBottom: 35,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#0D47A1",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 50,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
