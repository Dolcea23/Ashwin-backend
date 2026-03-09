// src/api/apiConfig.ts
import Constants from "expo-constants";

const extra =
  (Constants.expoConfig?.extra) ??
  (Constants.easConfig as any)?.extra ??
  (Constants.manifest as any)?.extra ??
  (Constants.manifest2 as any)?.extra ??
  {};

const DEV_BACKEND = extra.BACKEND_URL as string | undefined;

export const BASE_URL = __DEV__
  ? (DEV_BACKEND || "https://ashwin-backend.onrender.com")
  : "https://ashwin-backend.onrender.com";

export const BACKEND = BASE_URL;