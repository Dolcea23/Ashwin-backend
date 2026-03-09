// utils/trialManager.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const TRIAL_ACTIVE = "ASHWIN_TRIAL_ACTIVE";
const TRIAL_START = "ASHWIN_TRIAL_START";
const TRIAL_ALERT_SHOWN = "ASHWIN_TRIAL_ALERT_SHOWN";

// -----------------------------
// Start 7-Day Trial
// -----------------------------
export const startTrial = async () => {
  const now = new Date().toISOString();
  await AsyncStorage.setItem(TRIAL_ACTIVE, "true");
  await AsyncStorage.setItem(TRIAL_START, now);
  await AsyncStorage.removeItem(TRIAL_ALERT_SHOWN);

  return { active: true, daysLeft: 7 };
};

// -----------------------------
// Get Trial Status
// -----------------------------
export const getTrialStatus = async () => {
  const active = await AsyncStorage.getItem(TRIAL_ACTIVE);
  const start = await AsyncStorage.getItem(TRIAL_START);

  if (!active || !start) {
    return { active: false, daysLeft: 0 };
  }

  const startDate = new Date(start);
  const daysPassed = Math.floor(
    (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysLeft = 7 - daysPassed;

  if (daysLeft > 0) {
    return { active: true, daysLeft };
  }

  // trial expired
  await AsyncStorage.removeItem(TRIAL_ACTIVE);

  return { active: false, daysLeft: 0, expired: true };
};

// -----------------------------
// Trial alert logic
// -----------------------------
export const markTrialAlertShown = async () => {
  await AsyncStorage.setItem(TRIAL_ALERT_SHOWN, "true");
};

export const shouldShowTrialAlert = async () => {
  const shown = await AsyncStorage.getItem(TRIAL_ALERT_SHOWN);
  return !shown;
};
