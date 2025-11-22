import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

/**
 * Watches local analytics and auto-exports to your dev machine.
 */
export async function autoExportBridge() {
  try {
    const logs = JSON.parse((await AsyncStorage.getItem("analytics")) || "[]");
    if (logs.length === 0) return;

    const json = JSON.stringify(logs, null, 2);
    const localPath = `${FileSystem.documentDirectory}mobile_analytics.json`;

    await FileSystem.writeAsStringAsync(localPath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log("📤 Auto-exported analytics to:", localPath);
  } catch (err) {
    console.error("❌ Auto-export failed:", err);
  }
}
