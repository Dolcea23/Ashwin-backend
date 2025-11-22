// utils/trialManager.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getTrialStatus = async () => {
  const active = await AsyncStorage.getItem("ASHWIN_TRIAL_ACTIVE");
  const start = await AsyncStorage.getItem("ASHWIN_TRIAL_START");

  if (active && start) {
    const startDate = new Date(start);
    const diffDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = 7 - diffDays;

    if (remaining > 0) {
      return { active: true, daysLeft: remaining };
    } else {
      await AsyncStorage.removeItem("ASHWIN_TRIAL_ACTIVE");
      return { active: false, daysLeft: 0, expired: true };
    }
  }

  return { active: false, daysLeft: 0 };
};
