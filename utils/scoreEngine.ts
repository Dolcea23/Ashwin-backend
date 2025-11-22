// utils/scoreEngine.ts

export type Metrics = {
  heartRate?: number;     // bpm
  temperatureF?: number;  // °F
  brainLevel?: number;    // 0..1 normalized activity or “stability”
};

/** Clamp helper */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** 0..100 — higher is better. HR best range ~60..85 while sleeping */
export function heartRateScore(hr?: number): number {
  if (!hr || !Number.isFinite(hr)) return 50;
  // Penalize distance from the 60..85 window, soft edges
  const lo = 60, hi = 85;
  if (hr >= lo && hr <= hi) return 100;
  const dist = hr < lo ? lo - hr : hr - hi;
  // Every 10 bpm away costs ~25 points
  return clamp(100 - (dist / 10) * 25, 0, 100);
}

/** 0..100 — best range ~97.5..98.9°F */
export function temperatureScore(tempF?: number): number {
  if (!tempF || !Number.isFinite(tempF)) return 50;
  const lo = 97.5, hi = 98.9;
  if (tempF >= lo && tempF <= hi) return 100;
  const dist = tempF < lo ? lo - tempF : tempF - hi;
  // Every 0.5°F away costs ~20 points
  return clamp(100 - (dist / 0.5) * 20, 0, 100);
}

/** 0..100 — brainLevel 0..1 where 1 = very stable/restful pattern */
export function brainScore(level?: number): number {
  if (level == null || !Number.isFinite(level)) return 50;
  return clamp(level * 100, 0, 100);
}

/** Weighted overall score 0..100 */
export function sleepWellnessScore(m: Metrics): number {
  const h = heartRateScore(m.heartRate);
  const t = temperatureScore(m.temperatureF);
  const b = brainScore(m.brainLevel);
  return Math.round(0.5 * h + 0.3 * t + 0.2 * b);
}

/** Color zones for the UI */
export function scoreColor(score: number): string {
  if (score >= 75) return "#16a34a"; // green
  if (score >= 50) return "#f59e0b"; // yellow
  return "#dc2626";                   // red
}

/** Quick label */
export function scoreLabel(score: number): "Excellent" | "Moderate" | "Poor" {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Moderate";
  return "Poor";
}
