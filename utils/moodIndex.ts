export function calculateAshwinIndex({ eeg, ecg, temperature }: any) {
  // Normalize
  const normEEG  = Math.min(Math.max(eeg / 10, 0), 1);
  const normECG  = Math.min(Math.max((ecg - 60) / 60, 0), 1);
  const normTemp = Math.min(Math.max((temperature - 96) / 4, 0), 1);

  // Weighted average (tweakable)
  const score = (normEEG * 0.4 + normECG * 0.3 + normTemp * 0.3) * 100;

  return Number(score.toFixed(2));
}
