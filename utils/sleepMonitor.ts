import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Vibration } from "react-native";

let monitoring = false;
let sessionStart: string | null = null;

// Simulated sensor values
let eeg = 0, ecg = 0, eda = 0;

export async function startSleepMonitor() {
  console.log("Ashwin Sleep Monitor started");
  monitorLoop();
}

async function monitorLoop() {
  setInterval(async () => {
    eeg = Math.floor(50 + Math.random() * 30);
    ecg = Math.floor(60 + Math.random() * 25);
    eda = Math.floor(20 + Math.random() * 20);

    const sleepActive = eeg < 65 && ecg < 75 && eda < 30;

    if (sleepActive && !monitoring) {
      sessionStart = new Date().toISOString();
      monitoring = true;
      console.log("🟢 Sleep detected");
    }

    if (!sleepActive && monitoring) {
      const end = new Date().toISOString();
      const duration = Math.max(1, Math.random() * 8);
      const session = { start: sessionStart, end, duration, eeg, ecg, eda };
      await logSleepSession(session);
      monitoring = false;
      console.log("🔵 Sleep ended, session saved:", session);

      // Optional gentle vibration or wake tone
      Vibration.vibrate(300);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Good Morning 🌤",
          body: "Your sleep session has been recorded.",
        },
        trigger: null,
      });
    }
  }, 60000); // check once per minute
}

async function logSleepSession(session) {
  try {
    const stored = await AsyncStorage.getItem("sleepHistory");
    const list = stored ? JSON.parse(stored) : [];
    list.push(session);
    await AsyncStorage.setItem("sleepHistory", JSON.stringify(list));
  } catch (err) {
    console.log("Error saving sleep session:", err);
  }
}
