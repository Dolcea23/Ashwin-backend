import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

/**
 * Export stored analytics logs from phone → local project folder (when connected via Expo)
 */
export async function exportAnalyticsToBinder() {
  const logs = JSON.parse((await AsyncStorage.getItem("analytics")) || "[]");
  const json = JSON.stringify(logs, null, 2);
  const localPath = `${FileSystem.documentDirectory}mobile_analytics.json`;

  await FileSystem.writeAsStringAsync(localPath, json, { encoding: FileSystem.EncodingType.UTF8 });
  console.log("📤 Mobile analytics exported to:", localPath);
}
