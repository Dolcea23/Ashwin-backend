import { Platform } from "react-native";

export function logPatentEntry(data: any) {
  try {
    // Log to console in React Native (iOS/Android)
    if (Platform.OS === "ios" || Platform.OS === "android") {
      console.log("🧠 DEBUG:", data);
      return;
    }

    // Web or Node environment – safe to use fs
    const fs = require("fs");
    const path = require("path");
    const patentPath = path.join(process.cwd(), "docs/patent/03_Algorithms.md");

    const log = `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync(patentPath, log);

  } catch (error) {
    console.log("Logger error:", error);
  }
}
