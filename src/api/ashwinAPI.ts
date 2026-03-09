// 🌐 Permanent Backend Domain
import { BASE_URL } from "./apiConfig";
export { BASE_URL };


// 🧠 Send sensor data to backend
export async function sendSensorData(
  userId: number,
  sensorType: string,
  value: number,
  extras: any = {}
) {
  try {
    const res = await fetch(`${BASE_URL}/ingest/raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        sensor_type: sensorType,
        value,
        ...extras,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error("❌ sendSensorData error:", err);
    return null;
  }
}

// 📊 Get latest user report
export async function fetchUserReport(userId: number) {
  const res = await fetch(`${BASE_URL}/report/${userId}`);
  return res.json();
}

// 📈 Get trend analysis
export async function fetchTrend(userId: number) {
  const res = await fetch(`${BASE_URL}/analyze/trend/${userId}`);
  return res.json();
}

// 🔮 Predict next Ashwin Index
export async function fetchPrediction(userId: number) {
  const res = await fetch(`${BASE_URL}/predict/${userId}`);
  return res.json();
}

// 🗣️ Get narrative story summary
export async function fetchNarrative(userId: number) {
  const res = await fetch(`${BASE_URL}/narrative/${userId}`);
  return res.json();
}

// 🏅 Get reward badges
export async function fetchRewards(userId: number) {
  const res = await fetch(`${BASE_URL}/rewards/${userId}`);
  return res.json();
}

// 📄 Export user report
export async function fetchExport(userId: number) {
  const res = await fetch(`${BASE_URL}/export/${userId}`);
  return res.json();
}
