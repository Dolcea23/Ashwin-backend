import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import WheelPickerExpo from "react-native-wheel-picker-expo";

// ------------------------
// BACKEND CONFIG UPDATED
// ------------------------
import { BACKEND } from "../../src/api/apiConfig";



type AnswerMap = Record<string, string>;

type Question =
  | {
      id: string;
      text: string;
      helper?: string;
      type: "choice";
      options: string[];
    }
  | {
      id: string;
      text: string;
      helper?: string;
      type: "input";
      keyboard?: "default" | "numeric";
      placeholder?: string;
    }
  | {
      id: string;
      text: string;
      helper?: string;
      type: "legal";
    };

// ------------------------
// WHEEL OPTIONS
// ------------------------
const ageOptions = Array.from({ length: 96 }, (_, i) => 5 + i); // 5–100

// 4'0" – 7'0" in 1-inch steps
const heightOptions = (() => {
  const items: string[] = [];
  for (let inches = 48; inches <= 84; inches++) {
    const feet = Math.floor(inches / 12);
    const rem = inches % 12;
    items.push(`${feet}'${rem}"`);
  }
  return items;
})();

// ------------------------
// QUESTION SET (AI LEARNING)
// ------------------------
const questions: Question[] = [
  // A. Personal Profile
  {
    id: "age",
    text: "How old are you?",
    helper: "Helps Ashwin compare you to similar age patterns.",
    type: "input", // rendered as WHEEL in UI
    keyboard: "numeric",
    placeholder: "Enter your age",
  },
  {
    id: "sex",
    text: "How do you describe your sex?",
    type: "choice",
    options: ["Male", "Female", "Intersex", "Prefer not to say"],
  },
  {
    id: "height",
    text: "What is your height?",
    helper: "Scroll to select your height.",
    type: "input", // rendered as WHEEL in UI
    keyboard: "default",
    placeholder: "e.g. 5'9\" or 175 cm",
  },
  {
    id: "weight",
    text: "What is your weight?",
    helper: "You can use pounds or kilograms.",
    type: "input",
    keyboard: "numeric",
    placeholder: "e.g. 180 lb or 82 kg",
  },
  {
    id: "evening_caffeine",
    text: "Do you drink caffeine after 6 PM?",
    type: "choice",
    options: ["Never", "1–2x per week", "3–5x per week", "Almost every night"],
  },
  {
    id: "nicotine_use",
    text: "Do you use nicotine (smoking or vaping)?",
    type: "choice",
    options: ["No", "Sometimes", "Daily"],
  },
  {
    id: "alcohol_evening",
    text: "How often do you drink alcohol in the evening?",
    type: "choice",
    options: ["Never", "1–2 nights/week", "3–4 nights/week", "Most nights"],
  },

  // B. Sleep Behavior
  {
    id: "bedtime_window",
    text: "What time do you usually go to bed?",
    type: "choice",
    options: ["Before 10 PM", "10–11 PM", "11 PM–12 AM", "After 12 AM"],
  },
  {
    id: "wake_time_window",
    text: "What time do you usually wake up?",
    type: "choice",
    options: ["Before 5 AM", "5–7 AM", "7–9 AM", "After 9 AM"],
  },
  {
    id: "sleep_hours",
    text: "On most nights, how many hours do you sleep?",
    type: "choice",
    options: ["< 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "8+ hours"],
  },
  {
    id: "night_wakings",
    text: "How often do you wake up during the night?",
    type: "choice",
    options: ["Never", "1 time", "2–3 times", "4+ times"],
  },
  {
    id: "sleep_onset",
    text: "How long does it usually take you to fall asleep?",
    type: "choice",
    options: ["< 15 minutes", "15–30 minutes", "30–60 minutes", "Over 1 hour"],
  },
  {
    id: "phone_before_bed",
    text: "Do you use your phone or screens in bed?",
    type: "choice",
    options: ["Rarely / Never", "Sometimes", "Almost every night"],
  },
  {
    id: "snoring",
    text: "Have you been told that you snore or stop breathing in sleep?",
    type: "choice",
    options: ["No", "Snore only", "Possible pauses / gasps", "Not sure"],
  },

  // C. Mood & Stress
  {
    id: "stress_level",
    text: "How would you rate your current stress level?",
    type: "choice",
    options: ["Low", "Medium", "High", "Very high"],
  },
  {
    id: "anxiety_before_bed",
    text: "Do you feel anxious or have racing thoughts before bed?",
    type: "choice",
    options: ["Rarely", "Sometimes", "Most nights"],
  },
  {
    id: "mood_swings",
    text: "Have you noticed mood swings or emotional ups and downs lately?",
    type: "choice",
    options: ["No", "A little", "A lot"],
  },
  {
    id: "morning_energy",
    text: "How do you feel most mornings when you wake up?",
    type: "choice",
    options: ["Refreshed", "Okay", "Tired", "Exhausted"],
  },

  // D. Physical Symptoms
  {
    id: "wake_headache",
    text: "Do you wake up with headaches?",
    type: "choice",
    options: ["Never", "1–2x per month", "1–2x per week", "Most days"],
  },
  {
    id: "night_heart_race",
    text: "Do you ever wake up with your heart racing or pounding?",
    type: "choice",
    options: ["Never", "Rarely", "Sometimes", "Often"],
  },
  {
    id: "night_sweats",
    text: "Do you sweat or feel very hot while sleeping?",
    type: "choice",
    options: ["Rarely", "Sometimes", "Most nights"],
  },
  {
    id: "restless_body",
    text: "Do you feel restless legs or an urge to move at night?",
    type: "choice",
    options: ["Never", "Sometimes", "Often"],
  },

  // E. Lifestyle & Goals
  {
    id: "exercise_freq",
    text: "How often do you move or exercise each week?",
    type: "choice",
    options: ["Hardly ever", "1–2 days", "3–4 days", "5+ days"],
  },
  {
    id: "naps",
    text: "How often do you nap during the day?",
    type: "choice",
    options: ["Never", "1–2x per week", "3–5x per week", "Most days"],
  },
  {
    id: "primary_goal",
    text: "What is your primary goal with Ashwin?",
    type: "choice",
    options: [
      "Improve sleep quality",
      "Reduce stress & anxiety",
      "Track my health patterns",
      "All of the above",
    ],
  },
  {
    id: "guidance_style",
    text: "How do you prefer Ashwin to coach you?",
    type: "choice",
    options: ["Gentle & encouraging", "Direct & honest", "Data-focused"],
  },

  // F. Legal / Consent
  {
    id: "legal_accept",
    text: "Before we finish, please review and accept the terms below.",
    helper:
      "Ashwin Wellness is a wellness tool only. It does not diagnose, treat, or cure any medical condition.",
    type: "legal",
  },
];

export default function Questionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentInput, setCurrentInput] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);
  const [userId, setUserId] = useState<number | null>(null);

  // Wheel state
  const [ageIndex, setAgeIndex] = useState(35); // ~40 years old
  const [heightIndex, setHeightIndex] = useState(
    Math.max(heightOptions.indexOf("5'8\""), 0)
  );

  const totalSteps = questions.length;
  const current = questions[step];

  // Load user ID if we have it
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedId = await AsyncStorage.getItem("ASHWIN_USER_ID");
        if (storedId) {
          setUserId(Number(storedId));
          return;
        }
        const storedUser = await AsyncStorage.getItem("ASHWIN_USER");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const id = parsed?.id || parsed?.user_id;
          if (id) setUserId(Number(id));
        }
      } catch (e) {
        console.warn("Failed to load user id", e);
      }
    };
    loadUser();
  }, []);

  const goNext = async (value: string) => {
    const updated: AnswerMap = { ...answers, [current.id]: value };
    setAnswers(updated);
    setCurrentInput("");

    // If there are more questions, move on
    if (step + 1 < totalSteps) {
      setStep(step + 1);
      return;
    }

    // Final step: save + send to backend
    try {
      const payload = {
        user_id: userId,
        createdAt: new Date().toISOString(),
        version: "onboarding_v3",
        ...updated,
      };

      await AsyncStorage.setItem(
        "ASHWIN_PROFILE_BASELINE",
        JSON.stringify(payload)
      );
      await AsyncStorage.setItem("onboardingComplete", "true");

      try {
        const res = await fetch(`${BACKEND}/baseline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log("✅ Baseline uploaded:", text);
      } catch (err) {
        console.warn("⚠️ Failed to send baseline:", err);
      }

      setShowConfetti(true);
      confettiRef.current?.start();

      setTimeout(() => {
        router.replace("/(onboarding)/congratulations");
      }, 2600);
    } catch (e) {
      console.warn("Onboarding save failed:", e);
      router.replace("/(onboarding)/congratulations");
    }
  };

  const handleChoice = (option: string) => {
    goNext(option);
  };

  const handleInputNext = () => {
    if (!currentInput.trim()) return;
    goNext(currentInput.trim());
  };

  const handleAgeConfirm = () => {
    const age = ageOptions[ageIndex];
    goNext(String(age));
  };

  const handleHeightConfirm = () => {
    const heightLabel = heightOptions[heightIndex];
    goNext(heightLabel);
  };

  const progressLabel = `Question ${Math.min(
    step + 1,
    totalSteps
  )} of ${totalSteps}`;

  const isAgeQuestion = current.id === "age";
  const isHeightQuestion = current.id === "height";

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
        <Text style={styles.headerTop}>Ashwin is learning your baseline.</Text>
        <Text style={styles.headerProgress}>{progressLabel}</Text>

        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.question}>{current.text}</Text>
            {current.helper ? (
              <Text style={styles.helper}>{current.helper}</Text>
            ) : null}

            {/* AGE WHEEL */}
            {isAgeQuestion && (
              <View style={styles.wheelBlock}>
                <WheelPickerExpo
                  height={160}
                  width={120}
                  selectedIndex={ageIndex}
                  initialSelectedIndex={ageIndex}
                  items={ageOptions.map((age) => ({
                    label: String(age),
                    value: age,
                  }))}
                  onChange={({ index }) => setAgeIndex(index)}
                  renderItem={(props) => (
                    <Text
                      style={[
                        styles.wheelItem,
                        props.isSelected && styles.wheelItemSelected,
                      ]}
                    >
                      {props.label}
                    </Text>
                  )}
                />
                <Text style={styles.wheelHint}>Scroll to your age, then confirm.</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleAgeConfirm}
                >
                  <Text style={styles.primaryButtonText}>Confirm Age</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* HEIGHT WHEEL */}
            {isHeightQuestion && (
              <View style={styles.wheelBlock}>
                <WheelPickerExpo
                  height={160}
                  width={160}
                  selectedIndex={heightIndex}
                  initialSelectedIndex={heightIndex}
                  items={heightOptions.map((h) => ({
                    label: h,
                    value: h,
                  }))}
                  onChange={({ index }) => setHeightIndex(index)}
                  renderItem={(props) => (
                    <Text
                      style={[
                        styles.wheelItem,
                        props.isSelected && styles.wheelItemSelected,
                      ]}
                    >
                      {props.label}
                    </Text>
                  )}
                />
                <Text style={styles.wheelHint}>
                  Scroll to your height, then confirm.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleHeightConfirm}
                >
                  <Text style={styles.primaryButtonText}>Confirm Height</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* NORMAL INPUTS (everything that is NOT age/height) */}
            {current.type === "input" &&
              !isAgeQuestion &&
              !isHeightQuestion && (
                <View style={{ marginTop: 24 }}>
                  <TextInput
                    style={styles.input}
                    value={currentInput}
                    onChangeText={setCurrentInput}
                    placeholder={
                      "placeholder" in current
                        ? current.placeholder
                        : "Type your answer"
                    }
                    keyboardType={
                      "keyboard" in current && current.keyboard === "numeric"
                        ? "number-pad"
                        : "default"
                    }
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      !currentInput.trim() && { opacity: 0.4 },
                    ]}
                    disabled={!currentInput.trim()}
                    onPress={handleInputNext}
                  >
                    <Text style={styles.primaryButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}

            {/* CHOICE TYPE */}
            {current.type === "choice" && "options" in current && (
              <View style={styles.options}>
                {current.options.map((option) => {
                  const isSelected = answers[current.id] === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.option,
                        isSelected && styles.optionSelected,
                      ]}
                      onPress={() => handleChoice(option)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* LEGAL TYPE – full scroll area like Apple */}
            {current.type === "legal" && (
              <View style={{ marginTop: 20 }}>
                <View style={styles.legalBoxOuter}>
                  <ScrollView
                    style={styles.legalScroll}
                    contentContainerStyle={{ padding: 12 }}
                    showsVerticalScrollIndicator
                  >
                    <Text style={styles.legalTitle}>
                      Ashwin Wellness – Terms of Use
                    </Text>
                    <Text style={styles.legalText}>
                      1. Purpose{"\n"}
                      Ashwin Wellness is a consumer wellness and self-tracking
                      experience designed to help you reflect on your sleep,
                      stress, and lifestyle patterns. It is not a medical device
                      and is not intended to diagnose, treat, cure, or prevent
                      any disease or condition.{"\n\n"}
                      2. No Medical Advice{"\n"}
                      Any scores, suggestions, trends, or insights provided by
                      Ashwin are for general wellness and educational purposes
                      only. They should never be used as a replacement for
                      professional medical advice, diagnosis, or treatment.
                      Always seek the advice of a physician or other qualified
                      health provider with any questions you may have
                      regarding a medical condition.{"\n\n"}
                      3. Emergency Use{"\n"}
                      Ashwin is not an emergency service. Do not rely on Ashwin
                      to contact emergency responders or family members in
                      critical or life-threatening situations. If you think you
                      may be experiencing a medical emergency, call your local
                      emergency number immediately.{"\n\n"}
                      4. User Responsibilities{"\n"}
                      You agree to use Ashwin in a responsible way and to
                      provide accurate information during onboarding. You are
                      responsible for maintaining the security of your device
                      and any access codes or PINs.{"\n\n"}
                      5. Data & Algorithms{"\n"}
                      Ashwin uses your data to compute internal wellness
                      indexes (including the Ashwin Harmony / Ashwin Index) and
                      to improve pattern recognition over time. These
                      algorithms are experimental and may change as the system
                      learns. Results may vary and are not guaranteed.{"\n\n"}
                      6. Limitation of Liability{"\n"}
                      To the maximum extent permitted by law, Ashwin Wellness
                      and its creators are not liable for any indirect,
                      incidental, or consequential damages arising from your use
                      of the app or hardware.{"\n\n"}
                      7. Changes to the Service{"\n"}
                      Features, scoring models, and visualizations may change
                      over time as we improve the experience. We may update the
                      Terms of Use from time to time inside the app.{"\n\n"}
                    </Text>

                    <Text style={styles.legalTitle}>
                      Privacy Policy (Summary)
                    </Text>
                    <Text style={styles.legalText}>
                      • We collect basic profile information (such as age,
                      sleep habits, and wellness goals) and sensor data from
                      the pillow and related hardware.{"\n"}
                      • This data is used to compute your Ashwin indexes and
                      generate wellness insights for you.{"\n"}
                      • We do not sell your personal data to third parties.{"\n"}
                      • Data may be de-identified and aggregated to help
                      improve Ashwin’s algorithms and features.{"\n"}
                      • You can request to stop using the product at any time
                      by uninstalling the app and powering off the hardware.{"\n\n"}
                      The full Terms of Use and Privacy Policy are available
                      inside the app under Profile &gt; Legal. By selecting
                      “I Understand & Agree” below, you confirm that you have
                      read and agree to these terms and that you understand
                      Ashwin is a wellness product, not a medical device.
                    </Text>
                  </ScrollView>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 18 }]}
                  onPress={() => goNext("accepted")}
                >
                  <Text style={styles.primaryButtonText}>
                    I Understand & Agree
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>

        <Text style={styles.footerNote}>
          The more you share, the better Ashwin can read your patterns while you
          rest.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F4F6" },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  headerTop: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  headerProgress: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 14,
    textAlign: "center",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  question: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  helper: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  options: {
    marginTop: 18,
  },
  option: {
    backgroundColor: "#EFF6FF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  optionSelected: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  optionText: {
    fontSize: 15,
    color: "#1F2937",
    textAlign: "center",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  wheelBlock: {
    marginTop: 20,
    alignItems: "center",
  },
  wheelItem: {
    fontSize: 18,
    color: "#9CA3AF",
    textAlign: "center",
  },
  wheelItemSelected: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 22,
  },
  wheelHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  legalBoxOuter: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: 260,
  },
  legalScroll: {
    borderRadius: 12,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  legalText: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginVertical: 12,
  },
});
