// src/api/rewards.ts
import { BASE_URL } from "./ashwinAPI";

export async function fetchRewards(userId: number) {
  try {
    const res = await fetch(`${BASE_URL}/rewards/${userId}`);
    return await res.json();
  } catch (e) {
    console.log("❌ Rewards fetch failed:", e);
    return null;
  }
}
