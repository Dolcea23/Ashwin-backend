import { logPatentEntry } from "../utils/logger";

export interface SensorInputs {
  [key: string]: number; // allows any sensor name: eeg, ecg, temp, etc.
}

// Adaptive algorithm: works with 1 or many sensors
export function calculateAshwinIndex(data: SensorInputs): number {
  const weights: Record<string, number> = {
    eeg: 0.4,
    ecg: 0.4,
    temperature: 0.2,
    emg: 0.3,
    hrv: 0.3,
  };

  let total = 0;
  let weightSum = 0;

  for (const key in data) {
    if (weights[key]) {
      total += data[key] * weights[key];
      weightSum += weights[key];
    }
  }

  // default fallback to EEG only
  if (weightSum === 0 && data.eeg) {
    total = data.eeg;
    weightSum = 1;
  }

  const moodScore = total / weightSum;
  logPatentEntry(
    `calculateAshwinIndex(): ${JSON.stringify(data)} → MoodScore=${moodScore.toFixed(2)}`
  );
  return moodScore;
}
