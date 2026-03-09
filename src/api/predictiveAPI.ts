import { BASE_URL } from "./apiConfig";
export { BASE_URL };

export async function fetchPrediction(userId: number) {
  try {
    const res = await fetch(`${BASE_URL}/predict/summary/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.log("⚠️ predict fetch failed", e);
    return null;
  }
}
