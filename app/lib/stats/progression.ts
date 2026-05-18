export type ProgressionInput = {
  rating: number | null;
  wins: number;
  matchesPlayed: number;
  achievementPoints: number;
};

export type ProgressionSnapshot = {
  level: number;
  progress: number;
  currentXp: number;
  nextLevelXp: number;
  totalXp: number;
};

export type AchievementPointEntry = {
  points: number;
  completedAt: Date | null;
};

const ratingBaseline = 800;
const winWeight = 25;
const matchWeight = 10;
const achievementWeight = 5;
const levelStep = 500;

export function calculateAchievementPoints(entries: AchievementPointEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.completedAt ? entry.points : 0), 0);
}

export function calculateTotalXp(input: ProgressionInput): number {
  const rating = input.rating ?? ratingBaseline;
  const ratingScore = Math.max(0, rating - ratingBaseline);
  const winScore = Math.max(0, input.wins) * winWeight;
  const matchScore = Math.max(0, input.matchesPlayed) * matchWeight;
  const achievementScore = Math.max(0, input.achievementPoints) * achievementWeight;

  return ratingScore + winScore + matchScore + achievementScore;
}

export function calculateLevelProgress(input: ProgressionInput): ProgressionSnapshot {
  const totalXp = calculateTotalXp(input);
  const level = Math.max(1, Math.floor(totalXp / levelStep) + 1);
  const currentLevelStart = (level - 1) * levelStep;
  const nextLevelXp = level * levelStep;
  const currentXp = totalXp - currentLevelStart;
  const progress =
    nextLevelXp === currentLevelStart
      ? 1
      : Math.min(Math.max(currentXp / (nextLevelXp - currentLevelStart), 0), 1);

  return {
    level,
    progress,
    currentXp,
    nextLevelXp,
    totalXp,
  };
}
