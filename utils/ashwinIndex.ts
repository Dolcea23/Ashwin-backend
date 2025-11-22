// utils/ashwinIndex.ts

/**
 * Simple color scale helper for Ashwin Index scores
 */
export function getColorForScore(score: number): string {
  if (score >= 86) return "#2196F3"; // Blue - Excellent
  if (score >= 71) return "#4CAF50"; // Green - Good
  if (score >= 51) return "#FFC107"; // Yellow - Moderate
  if (score >= 31) return "#FF9800"; // Orange - Low
  return "#F44336"; // Red - Critical
}
