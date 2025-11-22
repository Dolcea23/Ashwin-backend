import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

export default function MorningSync() {
  const [visible, setVisible] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning 🌅");
    else if (hour < 18) setGreeting("Good Afternoon ☀️");
    else setGreeting("Good Evening 🌙");

    // fade in popup
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // auto-hide after 5 sec
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.popup, { opacity: fadeAnim }]}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.message}>
        Syncing your energy for the day... stay balanced and focused.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "rgba(13, 71, 161, 0.95)",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  greeting: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    color: "#E3F2FD",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
