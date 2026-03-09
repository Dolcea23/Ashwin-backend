// src/api/envSync.ts

// 🌐 Permanent backend domain (no more Cloudflare temp URLs)
import { BASE_URL } from "./apiConfig";
export { BASE_URL };

export async function fetchEnvironmentReport(userId: number) {
  try {
    const response = await fetch(`${BASE_URL}/envsync/report/${userId}`);
    const data = await response.json();
    console.log("🌍 Environment report:", data);
    return data;
  } catch (error) {
    console.error("❌ Error fetching environment report:", error);
    return null;
  }
}
