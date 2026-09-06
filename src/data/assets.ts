import type { Animation } from "../game/types";
/** All URLs are optional. Public assets are addressed from /assets, never /public/assets. */
export const assetConfig: {
  playerModel: string | null;
  modelScale: number;
  modelRotation: number;
  animationMap: Partial<Record<Animation, string>>;
  uniformTextures: [string | null, string | null];
  pitchTexture: string | null;
  audio: Partial<
    Record<
      "kick" | "shot" | "whistle" | "goal" | "post" | "tackle" | "ui" | "crowd",
      string
    >
  >;
} = {
  playerModel: null,
  modelScale: 1,
  modelRotation: 0,
  animationMap: {
    Idle: "Idle",
    Walk: "Walk",
    Jog: "Jog",
    Run: "Run",
    Sprint: "Sprint",
    Pass: "Pass",
    Shoot: "Shoot",
    Tackle: "Tackle",
    Celebrate: "Celebrate",
  },
  uniformTextures: [null, null],
  pitchTexture: null,
  audio: {},
};
