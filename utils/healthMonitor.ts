import { Alert } from "react-native";

/**
 * Evaluates health status and returns a warning message (if any)
 */
export const checkHealthStatus = (
  heartRate: number,
  temperatureF: number,
  calmness: number
) => {
  if (heartRate < 45) return "⚠️ Low heart rate detected. Possible bradycardia risk.";
  if (heartRate > 110) return "⚠️ Elevated heart rate. Possible stress or cardiac strain.";
  if (temperatureF > 100.5) return "🌡 High body temperature detected. Possible fever.";
  if (calmness < 30) return "⚠️ Unstable brain activity detected. Possible sleep disruption.";
  return null;
};

/**
 * Displays alerts when anomalies are detected
 */
export const handleHealthAlert = (
  heartRate: number,
  temperatureF: number,
  calmness: number
) => {
  const warning = checkHealthStatus(heartRate, temperatureF, calmness);
  if (warning) Alert.alert("Health Alert", warning);
};
