import { Animated } from "react-native";

/**
 * Returns an Animated background color based on moodScore (0-100)
 */
export const getMoodColor = (moodScore: number) => {
  if (moodScore < 40) return "#FF6B6B";        // Stress / hot
  if (moodScore < 70) return "#64B5F6";        // Neutral
  return "#81C784";                            // Calm
};

/**
 * Calculates a weighted mood score using heart rate + temperature
 */
export const calculateMoodScore = (heartRate: number, temp: number) => {
  let score = 100;

  if (heartRate > 90) score -= 20;
  if (heartRate < 50) score -= 10;
  if (temp > 99) score -= 15;
  if (temp < 96) score -= 5;

  return Math.max(0, Math.min(100, score));
};

/**
 * Animated color transition hook
 */
export const animateBackground = (
  animValue: Animated.Value,
  newColor: string,
  duration = 600
) => {
  Animated.timing(animValue, {
    toValue: 1,
    duration,
    useNativeDriver: false,
  }).start(() => animValue.setValue(0));
};
