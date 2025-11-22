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

// --- Save daily score for Insights/Home ---
export const saveSession = async (score: number, source: string) => {
  try {
    const date = new Date().toISOString().split("T")[0];
    const newEntry: SessionData = { date, score, source };

    const existing = await AsyncStorage.getItem("sessions");
    const parsed = existing ? JSON.parse(existing) : [];
    const updated = [...parsed, newEntry].slice(-30); // keep last 30 days
    await AsyncStorage.setItem("sessions", JSON.stringify(updated));
  } catch (e) {
    console.error("Error saving session:", e);
  }
};

// --- Get full session history (for Insights graphs) ---
export const getHistory = async (): Promise<SessionData[]> => {
  try {
    const data = await AsyncStorage.getItem("sessions");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error loading history:", e);
    return [];
  }
};

// --- Emergency Contact (for Live tab) ---
export const setEmergencyContact = async (contact: Contact) => {
  try {
    await AsyncStorage.setItem("emergencyContact", JSON.stringify(contact));
  } catch (e) {
    console.error("Error saving contact:", e);
  }
};

export const getEmergencyContact = async (): Promise<Contact | null> => {
  try {
    const data = await AsyncStorage.getItem("emergencyContact");
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error loading contact:", e);
    return null;
  }
};

