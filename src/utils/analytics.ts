// src/utils/analytics.ts
let scores: number[] = [];

export function recordScore(score: number) {
  scores.push(score);
  if (scores.length > 100) scores = scores.slice(-100); // keep last 100
}

export function getAverageScore(): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return parseFloat(avg.toFixed(2));
}
