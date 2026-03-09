import AsyncStorage from "@react-native-async-storage/async-storage";

interface SessionData {
  date: string;
  score: number;
  source: string;
}

interface Contact {
  name: string;
  phone: string;
}

// Keys (centralized for safety and reuse)
const SESSIONS_KEY = "ASHWIN_SESSIONS";
const CONTACT_KEY = "ASHWIN_EMERGENCY_CONTACT";

// ------------------------------
// Save Daily Score (Insights/Home)
// ------------------------------
export const saveSession = async (score: number, source: string) => {
  try {
    const date = new Date().toISOString().split("T")[0];

    const entry: SessionData = { date, score, source };

    const existing = await AsyncStorage.getItem(SESSIONS_KEY);
    const parsed: SessionData[] = existing ? JSON.parse(existing) : [];

    // Keep last 30 days to reduce local storage bloat
    const updated = [...parsed, entry].slice(-30);

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("❌ Error saving session:", e);
  }
};

// ------------------------------
// Load History (Insights graphs)
// ------------------------------
export const getHistory = async (): Promise<SessionData[]> => {
  try {
    const data = await AsyncStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("❌ Error loading history:", e);
    return [];
  }
};

// ------------------------------
// Emergency Contact (Live Tab)
// ------------------------------
export const setEmergencyContact = async (contact: Contact) => {
  try {
    await AsyncStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
  } catch (e) {
    console.error("❌ Error saving emergency contact:", e);
  }
};

export const getEmergencyContact = async (): Promise<Contact | null> => {
  try {
    const data = await AsyncStorage.getItem(CONTACT_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("❌ Error loading emergency contact:", e);
    return null;
  }
};
