// utils/sensorData.ts
type SensorData = {
  heartRate: number;
  temperatureF: number;
  brainActivity: number;
};

let subscribers: ((data: SensorData) => void)[] = [];
let interval: NodeJS.Timeout | null = null;

// Simulated live sensor data stream
export function startSensorStream() {
  if (interval) return; // already streaming

  interval = setInterval(() => {
    const data: SensorData = {
      heartRate: 60 + Math.random() * 20,
      temperatureF: 97.5 + Math.random() * 2,
      brainActivity: 0.4 + Math.random() * 0.4,
    };

    subscribers.forEach((cb) => cb(data));
  }, 2000);
}

export function stopSensorStream() {
  if (interval) clearInterval(interval);
  interval = null;
}

export function subscribeSensorStream(
  callback: (data: SensorData) => void
): () => void {
  subscribers.push(callback);
  startSensorStream();

  // unsubscribe when component unmounts
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
    if (subscribers.length === 0) stopSensorStream();
  };
}

