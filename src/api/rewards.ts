// src/api/rewards.ts

// 🌐 Permanent Production Backend (Cloudflare Tunnel)
import { BASE_URL } from "./apiConfig";
export { BASE_URL };


export async function fetchRewards(userId: number) {
  try {
    const res = await fetch(`${BASE_URL}/rewards/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.log("❌ Rewards fetch failed:", e);
    return null;
  }
}
