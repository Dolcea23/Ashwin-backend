// utils/feedbackEngine.ts
import { Metrics, brainScore, heartRateScore, temperatureScore } from "./scoreEngine";

/** Tiny rule-based feedback; we can replace with AI later */
export function generateFeedback(metrics: Metrics): string {
  const h = heartRateScore(metrics.heartRate);
  const t = temperatureScore(metrics.temperatureF);
  const b = brainScore(metrics.brainLevel);

  // Priority: critical, then targeted suggestions, then positive reinforcement
  if ((metrics.heartRate ?? 0) <= 35 && (metrics.brainLevel ?? 0) < 0.1) {
    return "No meaningful heart/brain activity detected. Ensure sensors are connected. If this persists while sleeping, seek immediate help.";
  }

  if (h < 50 && (metrics.heartRate ?? 0) > 95) {
    return "Elevated heart activity detected. Try avoiding caffeine 6–8 hours before bed and add 5–10 minutes of slow breathing.";
  }

  if (t < 60 && (metrics.temperatureF ?? 0) > 99.5) {
    return "Body temp ran warm. Consider a cooler room (65–68°F) and lighter bedding for better deep sleep.";
  }

  if (b < 55) {
    return "Brain activity looked restless. A consistent pre-sleep wind-down routine can help (dim lights, no phone 30 min).";
  }

  if (h >= 75 && t >= 75 && b >= 75) {
    return "Great recovery signals tonight. Keep your bedtime consistent to lock in this quality.";
  }

  return "Sleep was okay with room to improve. Try a regular bedtime and a 10-minute relax routine tonight.";
}
