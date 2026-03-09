// src/sensors/sensorMap.ts

export interface SensorData {
  eeg?: number;
  ecg?: number;
  temperature?: number;
}

/**
 * ✅ Real-only mode: NO random / mock data.
 * This forces the app to rely on backend/ESP32 pipelines.
 */
export function generateSensorData(): SensorData {
  return {};
}
