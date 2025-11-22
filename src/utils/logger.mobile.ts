// src/utils/logger.mobile.ts
import * as FileSystem from "expo-file-system";

const patentPath = `${FileSystem.documentDirectory}03_Algorithms.txt`;

export async function logPatentEntry(entry: string) {
  const timestamp = new Date().toISOString();
  const formatted = `\n### ${timestamp}\n${entry}\n`;
  await FileSystem.writeAsStringAsync(patentPath, formatted, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}
