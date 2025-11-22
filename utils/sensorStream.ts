// utils/sensorStream.ts
// Simulated live sensor stream for development and testing.
// Replace later with actual Bluetooth data feed when available.

export type SensorData = {
  heartRate: number;
  temperatureF: number;
  brainLevel: number;
};

let interval: NodeJS.Timer | null = null;

/**
 * Subscribe to a simulated sensor data stream.
 * @param callback Function called with new SensorData every 2 seconds.
 * @returns Function to unsubscribe.
 */
export function subscribeSensorStream(callback: (data: SensorData) => void): () => void {
  // If an old stream is running, clear it
  if (interval) clearInterval(interval);

  interval = setInterval(() => {
    const sample: SensorData = {
      heartRate: 60 + Math.random() * 40,       // 60–100 bpm
      temperatureF: 97.5 + Math.random() * 1.4, // 97.5–98.9°F
      brainLevel: Math.max(0, Math.min(1, 0.6 + (Math.random() - 0.5) * 0.2)), // 0–1
    };
    callback(sample);
  }, 2000);

  return () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}
