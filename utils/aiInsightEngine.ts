// utils/aiInsightEngine.ts

let _insightHistory: string[] = [];

// Tiny helper so we always have something to say even without inputs.
function synthesizeTip(score?: number) {
  if (score == null) {
    const generic = [
      "Try a consistent bedtime this week.",
      "Reduce screens 60 minutes before sleep.",
      "Keep your room cool and dark tonight.",
      "Avoid caffeine after 2pm for better rest.",
      "Light stretching can help you wind down."
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  }

  if (score >= 80) return "Great trend! Keep your routine steady and stay hydrated.";
  if (score >= 60) return "Solid night. A shorter wind-down might nudge you even higher.";
  if (score >= 40) return "Mixed signals. Try earlier lights-out and a cooler room.";
  return "Your body may be stressed. Aim for a calm pre-sleep routine and no late snacks.";
}

/**
 * Generate a short feedback string. Args are optional.
 * You can call generateSleepFeedback() with no args (as Home does now),
 * or pass the latest values to get more specific copy.
 */
export async function generateSleepFeedback(opts?: {
  moodScore?: number;
  heartRate?: number;
  temperatureF?: number;
}): Promise<string> {
  const tip = synthesizeTip(opts?.moodScore);
  _insightHistory.push(tip);
  if (_insightHistory.length > 50) _insightHistory = _insightHistory.slice(-50);
  return tip;
}

export function getInsightHistory(): string[] {
  return [..._insightHistory];
}

export function clearInsightHistory() {
  _insightHistory = [];
}
