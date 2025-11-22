import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/onboarding1.png")}
        style={styles.image}
        resizeMode="contain"
      />

      <Text style={styles.title}>Welcome to Ashwin Wellness</Text>
      <Text style={styles.subtitle}>
        Track, reflect, and improve your wellness journey with intelligent insight and simplicity.
      </Text>

      {/* Go to Sign Up */}
      <TouchableOpacity style={styles.button} onPress={() => router.replace("/signup")}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      {/* Go to Sign In */}
      <TouchableOpacity onPress={() => router.replace("/signin")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  image: {
    width: "90%",
    height: 250,
    marginBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0D47A1",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#0D47A1",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    color: "#0D47A1",
    fontWeight: "600",
    fontSize: 14,
  },
});
