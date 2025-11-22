import AsyncStorage from "@react-native-async-storage/async-storage";

export type SleepSession = {
  startTime: string | null;
  avg: number;
  duration: number;
  savedAt?: string;
};

const STORAGE_KEY = "ASHWIN_SLEEP_SESSIONS";

export async function saveSleepSession(session: SleepSession) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const sessions: SleepSession[] = existing ? JSON.parse(existing) : [];
    const newSession = { ...session, savedAt: new Date().toISOString() };
    sessions.unshift(newSession);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Error saving sleep session:", e);
  }
}

export async function getAllSessions(): Promise<SleepSession[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error loading sessions:", e);
    return [];
  }
}

export async function clearAllSessions() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
