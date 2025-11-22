// src/sensors/sensorMap.ts

export interface SensorData {
  eeg: number;
  ecg: number;
  temperature: number;
}

/**
 * Simulates dynamic EEG, ECG, and temperature readings every few seconds.
 * This data can be used by the AshwinIndex to calculate health feedback.
 */
export function generateSensorData(): SensorData {
  const eeg = Math.random() * 100; // brain signal range
  const ecg = 60 + Math.random() * 40; // heart rate 60–100 bpm
  const temperature = 97 + Math.random() * 3; // 97–100°F range

  return { eeg, ecg, temperature };
}
