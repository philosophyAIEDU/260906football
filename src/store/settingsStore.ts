import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../game/types";
export const defaults: Settings = {
  team: 0,
  difficulty: "normal",
  halfMinutes: 5,
  formation: "4-3-3",
  tactic: "balanced",
  offside: true,
  passAssist: "high",
  quality: "medium",
  volume: 0.65,
  crowdVolume: 0.5,
  effectsVolume: 0.8,
  muted: false,
  camera: 0,
  shake: false,
};
export const useSettings = create<{
  settings: Settings;
  update: (s: Partial<Settings>) => void;
}>()(
  persist(
    (set) => ({
      settings: defaults,
      update: (s) =>
        set((state) => ({ settings: { ...state.settings, ...s } })),
    }),
    { name: "touchline-settings-v1" },
  ),
);
