import type { Formation, TeamTactics, Vec, Tactic } from "../game/types";
import { clamp } from "../game/math";
export const formations: Record<Formation, Vec[]> = {
  "4-3-3": [
    [-49, 0],
    [-30, -25],
    [-34, -9],
    [-34, 9],
    [-30, 25],
    [-15, 0],
    [-4, -13],
    [-4, 13],
    [17, -25],
    [22, 0],
    [17, 25],
  ].map(([x, z]) => ({ x, z })),
  "4-4-2": [
    [-49, 0],
    [-31, -25],
    [-34, -9],
    [-34, 9],
    [-31, 25],
    [-7, -25],
    [-11, -8],
    [-11, 8],
    [-7, 25],
    [20, -9],
    [20, 9],
  ].map(([x, z]) => ({ x, z })),
  "4-2-3-1": [
    [-49, 0],
    [-31, -25],
    [-34, -9],
    [-34, 9],
    [-31, 25],
    [-15, -9],
    [-15, 9],
    [6, 0],
    [8, -25],
    [25, 0],
    [8, 25],
  ].map(([x, z]) => ({ x, z })),
  "3-5-2": [
    [-49, 0],
    [-32, -20],
    [-35, 0],
    [-32, 20],
    [-5, 28],
    [-14, 0],
    [-4, -12],
    [-4, 12],
    [-5, -28],
    [23, -9],
    [23, 9],
  ].map(([x, z]) => ({ x, z })),
  "5-3-2": [
    [-49, 0],
    [-28, -28],
    [-34, -16],
    [-37, 0],
    [-34, 16],
    [-28, 28],
    [-10, -13],
    [-12, 0],
    [-10, 13],
    [20, -9],
    [20, 9],
  ].map(([x, z]) => ({ x, z })),
};
const t = (
  defensiveLine: number,
  teamWidth: number,
  compactness: number,
  pressingIntensity: number,
  attackingSupport: number,
  passingRisk: number,
  transitionSpeed: number,
  fullbackOverlap: number,
): TeamTactics => ({
  defensiveLine,
  teamWidth,
  compactness,
  pressingIntensity,
  attackingSupport,
  passingRisk,
  transitionSpeed,
  fullbackOverlap,
});
export const tactics: Record<Tactic, TeamTactics> = {
  balanced: t(0.5, 0.8, 0.6, 0.5, 0.5, 0.4, 0.5, 0.4),
  attacking: t(0.75, 0.95, 0.4, 0.65, 0.9, 0.7, 0.8, 0.9),
  defensive: t(0.2, 0.65, 0.85, 0.3, 0.2, 0.15, 0.3, 0.1),
  pressing: t(0.85, 0.75, 0.8, 1, 0.6, 0.55, 0.8, 0.6),
  possession: t(0.6, 0.9, 0.7, 0.55, 0.6, 0.15, 0.35, 0.5),
  counter: t(0.3, 0.85, 0.65, 0.5, 0.8, 0.8, 1, 0.45),
};
export const tacticLabels: Record<Tactic, string> = {
  balanced: "균형",
  attacking: "공격적",
  defensive: "수비적",
  pressing: "강한 압박",
  possession: "점유율 중심",
  counter: "빠른 역습",
};
export function formationTarget(
  slot: number,
  formation: Formation,
  dir: number,
  ball: Vec,
  attacking: boolean,
  tactic: TeamTactics,
): Vec {
  const b = formations[formation][slot];
  if (slot === 0) return { x: -49 * dir, z: clamp(ball.z * 0.11, -2.8, 2.8) };
  const shift =
    clamp(ball.x * dir * 0.3, -12, 16) +
    (attacking ? 7 * tactic.attackingSupport : -4) +
    (tactic.defensiveLine - 0.5) * 12;
  return {
    x: clamp(
      (b.x * (1.12 - tactic.compactness * 0.2) +
        shift +
        (attacking && (slot === 1 || slot === 4)
          ? tactic.fullbackOverlap * 10
          : 0)) *
        dir,
      -48,
      48,
    ),
    z: clamp(
      b.z * (attacking ? 1 : 0.75) * (0.65 + tactic.teamWidth * 0.4) +
        ball.z * 0.18,
      -31,
      31,
    ),
  };
}
