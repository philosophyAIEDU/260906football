import type { Vec3, TeamId, RestartKind, Player, Vec } from "../game/types";
export const BALL_RADIUS = 0.11;
export type Boundary =
  | { kind: "goal"; team: TeamId }
  | { kind: RestartKind; team: TeamId; spot: Vec };
export function boundary(
  previous: Vec3,
  ball: Vec3,
  lastTeam: TeamId,
  homeDir: number,
): Boundary | null {
  const limit = 52.5 + BALL_RADIUS;
  if (Math.abs(ball.x) > limit) {
    const sign = Math.sign(ball.x);
    const denominator = ball.x - previous.x;
    const t = denominator
      ? Math.max(0, Math.min(1, (sign * limit - previous.x) / denominator))
      : 1;
    const y = previous.y + (ball.y - previous.y) * t,
      z = previous.z + (ball.z - previous.z) * t;
    const attacker = (sign === homeDir ? 0 : 1) as TeamId;
    if (
      Math.abs(z) < 3.66 - BALL_RADIUS &&
      y >= BALL_RADIUS - 0.04 &&
      y < 2.44 - BALL_RADIUS
    )
      return { kind: "goal", team: attacker };
    const defending = (1 - attacker) as TeamId;
    return lastTeam === defending
      ? {
          kind: "corner",
          team: attacker,
          spot: { x: sign * 52, z: Math.sign(ball.z || 1) * 33.5 },
        }
      : {
          kind: "goalKick",
          team: defending,
          spot: { x: sign * 47, z: ball.z > 0 ? 7 : -7 },
        };
  }
  if (Math.abs(ball.z) > 34 + BALL_RADIUS)
    return {
      kind: "throwIn",
      team: (1 - lastTeam) as TeamId,
      spot: {
        x: Math.max(-51, Math.min(51, ball.x)),
        z: Math.sign(ball.z) * 33.7,
      },
    };
  return null;
}
export function offsideCandidates(
  players: Player[],
  team: TeamId,
  ball: Vec,
  dir: number,
): number[] {
  const defenders = players
    .filter((p) => p.teamId !== team && !p.red)
    .map((p) => p.pos.x * dir)
    .sort((a, b) => b - a);
  const line = defenders[1] ?? 52.5;
  return players
    .filter(
      (p) =>
        p.teamId === team &&
        !p.red &&
        p.pos.x * dir > 0 &&
        p.pos.x * dir > ball.x * dir + 0.15 &&
        p.pos.x * dir > line + 0.15,
    )
    .map((p) => p.index);
}
export function isPenalty(spot: Vec, attackingDir: number) {
  return spot.x * attackingDir > 36 && Math.abs(spot.z) < 20.16;
}
export function halfExpired(elapsed: number, minutes: number) {
  return elapsed >= minutes * 60;
}
export function nextHalf(half: 1 | 2): "halftime" | "finished" {
  return half === 1 ? "halftime" : "finished";
}
export function stamina(
  energy: number,
  speed: number,
  sprint: boolean,
  dt: number,
  rating = 80,
) {
  return Math.max(
    0,
    Math.min(
      100,
      energy +
        dt *
          (sprint && speed > 4
            ? -(2.8 - rating * 0.015)
            : speed > 3
              ? -0.16
              : 0.9),
    ),
  );
}
