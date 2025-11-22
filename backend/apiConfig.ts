// src/api/apiConfig.ts
export const BASE_URL =
  Platform.OS === "ios"
    ? "http://127.0.0.1:8000" // when testing on iOS simulator
    : "http://192.168.254.153:8000"; // when using your real device on Wi-Fi

export const API_HEADERS = {
  "Content-Type": "application/json",
};
