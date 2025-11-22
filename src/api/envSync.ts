// src/api/envSync.ts
export const BASE_URL = "http://192.168.254.153:8000"; // your local IP

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
