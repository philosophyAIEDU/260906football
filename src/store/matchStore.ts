import { create } from "zustand";
import type { MatchPhase, TeamStats, MatchEvent } from "../game/types";
import { emptyStats } from "../systems/StatisticsSystem";
export interface MatchUI {
  phase: MatchPhase;
  half: 1 | 2;
  elapsed: number;
  score: [number, number];
  selected: number;
  energy: number;
  owner: number | null;
  notice: string;
  power: number;
  stats: [TeamStats, TeamStats];
  events: MatchEvent[];
  fps: number;
}
export const useMatch = create<MatchUI>(() => ({
  phase: "menu",
  half: 1,
  elapsed: 0,
  score: [0, 0],
  selected: 9,
  energy: 100,
  owner: null,
  notice: "",
  power: 0,
  stats: [emptyStats(), emptyStats()],
  events: [],
  fps: 60,
}));
