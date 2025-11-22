// src/api/predictiveAPI.ts
export const BASE_URL = "http://192.168.254.153:8000"; // your backend IP

export async function fetchPrediction(userId: number) {
  try {
    const res = await fetch(`${BASE_URL}/predict/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.log("⚠️ predict fetch failed", e);
    return null;
  }
}
