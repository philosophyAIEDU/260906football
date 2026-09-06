import type { TeamStats } from "../game/types";
export const emptyStats = (): TeamStats => ({
  possession: 0,
  shots: 0,
  onTarget: 0,
  passes: 0,
  completed: 0,
  tackles: 0,
  tacklesWon: 0,
  corners: 0,
  freeKicks: 0,
  fouls: 0,
  offsides: 0,
  yellows: 0,
  reds: 0,
  saves: 0,
});
export const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;
export const possessionPercent = (a: TeamStats, b: TeamStats) =>
  a.possession + b.possession
    ? percent(a.possession, a.possession + b.possession)
    : 50;
