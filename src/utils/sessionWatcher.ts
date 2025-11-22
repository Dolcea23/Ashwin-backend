import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "ASHWIN_USER";
const TIMESTAMP_KEY = "ASHWIN_LAST_ACTIVE";
const TIMEOUT_HOURS = 24; // ⏰ Auto logout after 24h

// 🔹 Call this when user performs any major action or screen focus
export const updateLastActive = async () => {
  const now = new Date().toISOString();
  await AsyncStorage.setItem(TIMESTAMP_KEY, now);
};

// 🔹 Check if session expired (returns true if expired)
export const checkSessionExpired = async (): Promise<boolean> => {
  try {
    const lastActive = await AsyncStorage.getItem(TIMESTAMP_KEY);
    if (!lastActive) return false; // first run
    const diff =
      (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60); // hours
    return diff >= TIMEOUT_HOURS;
  } catch (e) {
    console.warn("checkSessionExpired error:", e);
    return false;
  }
};

// 🔹 Clears session completely
export const clearSession = async () => {
  await AsyncStorage.multiRemove([SESSION_KEY, TIMESTAMP_KEY, "ASHWIN_PROFILE"]);
};
