import type { Player, Vec } from "../game/types";
import { distance, dot, normalize, segmentDistance } from "../game/math";
export const difficulty = {
  easy: {
    interval: 0.85,
    pressure: 0.2,
    accuracy: 0.48,
    keeperReaction: 0.5,
  },
  normal: {
    interval: 0.3,
    pressure: 0.85,
    accuracy: 0.86,
    keeperReaction: 0.18,
  },
  hard: { interval: 0.16, pressure: 1, accuracy: 0.96, keeperReaction: 0.12 },
};
export function passScore(
  from: Player,
  to: Player,
  aim: Vec,
  players: Player[],
  dir: number,
) {
  const d = distance(from.pos, to.pos);
  if (
    d < 3 ||
    d > 62 ||
    to.red ||
    from.index === to.index ||
    from.teamId !== to.teamId
  )
    return -Infinity;
  const direction = normalize(to.pos.x - from.pos.x, to.pos.z - from.pos.z);
  const obstruction = players.filter(
    (p) =>
      p.teamId !== from.teamId &&
      !p.red &&
      segmentDistance(p.pos, from.pos, to.pos) < 2,
  ).length;
  return (
    dot(direction, aim) * 25 +
    (to.pos.x - from.pos.x) * dir * 0.25 -
    Math.abs(d - 17) * 0.3 -
    obstruction * 15
  );
}
export function shotScore(player: Player, players: Player[], dir: number) {
  const goal = { x: 52.5 * dir, z: 0 };
  return (
    60 -
    distance(player.pos, goal) -
    Math.abs(player.pos.z) * 0.6 -
    players.filter(
      (p) =>
        p.teamId !== player.teamId &&
        !p.red &&
        segmentDistance(p.pos, player.pos, goal) < 1.8,
    ).length *
      6
  );
}
export function switchTarget(
  players: Player[],
  team: number,
  current: number,
  ball: Vec,
  velocity: Vec,
  receiver: number | null,
) {
  const future = {
    x: ball.x + velocity.x * 0.35,
    z: ball.z + velocity.z * 0.35,
  };
  return (
    players
      .filter((p) => p.teamId === team && p.index !== current && !p.red)
      .sort((a, b) => {
        const score = (p: Player) =>
          distance(p.pos, future) +
          (p.position === "GK" ? 16 : 0) -
          (p.index === receiver ? 10 : 0) -
          dot(
            normalize(future.x - p.pos.x, future.z - p.pos.z),
            normalize(p.vel.x, p.vel.z),
          ) *
            2;
        return score(a) - score(b);
      })[0]?.index ?? current
  );
}

export function opponentDifficulty(team:number,userTeam:number,level:keyof typeof difficulty){return difficulty[team===userTeam?'normal':level]}
