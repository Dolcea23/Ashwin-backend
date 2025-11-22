// src/utils/rewardSystem.ts
export const achievements = [
  {
    id: "calm-3",
    title: "Calm Starter",
    description: "Maintain index above 65 for 3 days.",
    tier: "Bronze",
    emoji: "🥉",
    color: "#CD7F32",
  },
  {
    id: "calm-5",
    title: "Flow Builder",
    description: "Maintain index above 75 for 5 days.",
    tier: "Silver",
    emoji: "🥈",
    color: "#C0C0C0",
  },
  {
    id: "calm-7",
    title: "Rhythm Master",
    description: "7 straight days of stable Ashwin Index.",
    tier: "Gold",
    emoji: "🥇",
    color: "#FFD700",
  },
    {
  id: "ultra-1",
  title: "System Harmony",
  description: "Hit 88+ index while on active trial.",
  tier: "Ultra",
  emoji: "💫",
  color: "#7C4DFF",
},

];

type Progress = {
  avg: number;
  streak: number;
  sessions: number;
};

export function evaluateAchievements(progress: Progress, alreadyUnlocked: string[]) {
  const newlyUnlocked: string[] = [];
  const allUnlocked = [...alreadyUnlocked];

  achievements.forEach((ach) => {
    let condition = false;
    if (ach.id === "calm-3") condition = progress.avg >= 65 && progress.sessions >= 3;
    if (ach.id === "calm-5") condition = progress.avg >= 75 && progress.sessions >= 5;
    if (ach.id === "calm-7") condition = progress.avg >= 80 && progress.sessions >= 7;
    if (ach.id === "ultra-1") condition = progress.avg >= 88;

    if (condition && !allUnlocked.includes(ach.id)) {
      allUnlocked.push(ach.id);
      newlyUnlocked.push(ach.id);
    }
  });

  return { allUnlocked, newlyUnlocked };
}
