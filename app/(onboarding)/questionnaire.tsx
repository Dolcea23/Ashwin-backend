import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

export default function Questionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);

  const questions = [
    { id: "age", text: "What is your age?", type: "input" },
    { id: "gender", text: "What is your gender?", options: ["Male", "Female", "Other"], type: "choice" },
    { id: "smoke", text: "Do you smoke?", options: ["Yes", "No"], type: "choice" },
    { id: "caffeine", text: "Do you drink caffeine daily?", options: ["Yes", "No"], type: "choice" },
    { id: "rested", text: "Do you wake up feeling rested?", options: ["Always", "Sometimes", "Rarely"], type: "choice" },
    { id: "anxiety", text: "Do you experience anxiety often?", options: ["Yes", "No"], type: "choice" },
    { id: "meditate", text: "Do you meditate weekly?", options: ["Yes", "No"], type: "choice" },
    { id: "chestPain", text: "Do you ever experience chest pain or shortness of breath?", options: ["Yes", "No"], type: "choice" },
    { id: "goal", text: "What is your primary wellness goal?", options: ["Improve Focus", "Reduce Stress", "Sleep Better"], type: "choice" },
    { id: "wearable", text: "Do you use any wearable device to track your health or sleep?", options: ["Yes", "No"], type: "choice" },
  ];

  const current = questions[step];

  const handleAnswer = async (value: string) => {
    const updated = { ...answers, [current.id]: value };
    setAnswers(updated);

    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      await AsyncStorage.setItem("ASHWIN_PROFILE_BASELINE", JSON.stringify(updated));
      await AsyncStorage.setItem("onboardingComplete", "true");

      // 🌐 Send to backend (mock live)
      try {
        const res = await fetch("https://ashwin.ai/api/baseline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        console.log("✅ Baseline uploaded:", await res.text());
      } catch (err) {
        console.warn("⚠️ Failed to send baseline:", err);
      }

      // 🎉 Confetti animation
      setShowConfetti(true);
      confettiRef.current?.start();

      setTimeout(() => {
        router.replace("/(onboarding)/congratulations");
      }, 3000);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {showConfetti && (
        <ConfettiCannon
          ref={confettiRef}
          count={180}
          origin={{ x: 200, y: 0 }}
          explosionSpeed={550}
          fadeOut
          fallSpeed={3200}
          colors={["#0D47A1", "#A7C7E7", "#E3F2FD", "#FFFFFF", "#B0BEC5"]}
        />
      )}

      <View style={styles.container}>
        <Text style={styles.header}>
          Question {step + 1} of {questions.length}
        </Text>
        <Text style={styles.question}>{current.text}</Text>

        <View style={styles.options}>
          {current.options ? (
            current.options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.option}
                onPress={() => handleAnswer(option)}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleAnswer("Entered")}
            >
              <Text style={styles.optionText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
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
    padding: 25,
  },
  header: {
    fontSize: 16,
    color: "#0D47A1",
    marginBottom: 10,
    fontWeight: "600",
  },
  question: {
    fontSize: 20,
    color: "#111",
    textAlign: "center",
    marginBottom: 40,
    fontWeight: "700",
    lineHeight: 28,
  },
  options: { width: "100%" },
  option: {
    backgroundColor: "#0D47A1",
    paddingVertical: 14,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: "center",
  },
  optionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
