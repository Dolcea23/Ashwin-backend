import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SleepSession {
  heartRate: number;
  temperatureF: number;
  calmness: number;
  timestamp: number;
}

/**
 * Save a nightly sleep record
 */
export async function logSleepSession(data: SleepSession) {
  try {
    const historyRaw = await AsyncStorage.getItem("sleepHistory");
    const history: SleepSession[] = historyRaw ? JSON.parse(historyRaw) : [];
    const updated = [...history.slice(-6), data]; // Keep only the last 7 sessions
    await AsyncStorage.setItem("sleepHistory", JSON.stringify(updated));
  } catch (e) {
    console.error("Error saving sleep session:", e);
  }
}

/**
 * Generate AI-style feedback from recent patterns
 */
export async function generateSleepFeedback(): Promise<string> {
  try {
    const historyRaw = await AsyncStorage.getItem("sleepHistory");
    if (!historyRaw) return "No recent sleep data found.";

    const history: SleepSession[] = JSON.parse(historyRaw);
    const avgHR =
      history.reduce((a, b) => a + b.heartRate, 0) / history.length;
    const avgTemp =
      history.reduce((a, b) => a + b.temperatureF, 0) / history.length;
    const avgCalm =
      history.reduce((a, b) => a + b.calmness, 0) / history.length;

    if (avgHR < 55 && avgCalm > 70)
      return "💤 Excellent recovery! Your sleep shows deep relaxation.";
    if (avgHR > 100)
      return "⚠️ Elevated heart rate trend. Try reducing caffeine before sleep.";
    if (avgTemp > 100)
      return "🌡 Your temperature is trending higher — check your room ventilation.";
    if (avgCalm < 40)
      return "🧠 High stress or restlessness detected. Consider meditation before bed.";

    return "😴 Your sleep pattern looks balanced overall. Keep it steady!";
  } catch (e) {
    console.error("Error generating feedback:", e);
    return "Unable to generate feedback at this time.";
  }
}
