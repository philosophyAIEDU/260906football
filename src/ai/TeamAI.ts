import type { Player, Vec, TeamId, Settings } from "../game/types";
import { formationTarget, tactics } from "./formations";
import { clamp, distance, normalize } from "../game/math";
import { difficulty } from "./decisionScoring";
export interface AIContext {
  players: Player[];
  ball: Vec;
  ballVelocity: Vec;
  owner: number | null;
  selected: number;
  settings: Settings;
  dir: (team: TeamId) => number;
  receiver: number | null;
  time: number;
  lastLoss: number;
  losingTeam: TeamId | null;
}
export function updateTeamAI(c: AIContext) {
  for (const team of [0, 1] as TeamId[]) {
    const lineup = c.players.filter((p) => p.teamId === team && !p.red);
    const own = c.owner === null ? null : c.players[c.owner];
    const attack = own?.teamId === team;
    const tac =
      tactics[team === c.settings.team ? c.settings.tactic : "balanced"];
    const dir = c.dir(team);
    const ranked = lineup
      .filter((p) => p.slot !== 0 && p.index !== c.selected)
      .sort((a, b) => distance(a.pos, c.ball) - distance(b.pos, c.ball));
    for (const p of lineup) {
      if (p.index === c.selected || c.time < p.thinkAt) continue;
      p.thinkAt =
        c.time +
        difficulty[c.settings.difficulty].interval +
        (p.slot % 3) * 0.02;
      if (p.slot === 0) {
        const ownGoal = -52.5 * dir;
        const threat = clamp((c.ball.x * dir + 52.5) / 35, 0, 1);
        let z = clamp(c.ball.z * 0.13, -2.8, 2.8);
        if (c.ballVelocity.x * dir < -4) {
          const arrival = (ownGoal - c.ball.x) / c.ballVelocity.x;
          if (arrival > 0 && arrival < 2)
            z = clamp(c.ball.z + c.ballVelocity.z * arrival, -3.3, 3.3);
        }
        p.target = { x: ownGoal + dir * (1.4 + (1 - threat) * 2.7), z };
        p.ai = "coverSpace";
        continue;
      }
      p.target = formationTarget(
        p.slot,
        team === c.settings.team ? c.settings.formation : "4-3-3",
        dir,
        c.ball,
        attack,
        tac,
      );
      p.ai = attack ? "supportAttack" : "coverSpace";
      for (const missing of c.players) {
        if (
          missing.teamId === team &&
          missing.red &&
          Math.abs(missing.slot - p.slot) <= 2
        ) {
          const vacant = formationTarget(
            missing.slot,
            team === c.settings.team ? c.settings.formation : "4-3-3",
            dir,
            c.ball,
            attack,
            tac,
          );
          p.target.z += (vacant.z - p.target.z) * 0.2;
        }
      }
      if (c.receiver === p.index) {
        p.target = {
          x: clamp(c.ball.x + c.ballVelocity.x * 0.55, -50, 50),
          z: clamp(c.ball.z + c.ballVelocity.z * 0.55, -32, 32),
        };
        p.ai = "receivePass";
      } else if (!own && ranked[0]?.index === p.index) {
        p.target = {
          x: c.ball.x + c.ballVelocity.x * 0.22,
          z: c.ball.z + c.ballVelocity.z * 0.22,
        };
        p.ai = "chaseBall";
      } else if (own && own.teamId !== team && ranked[0]?.index === p.index) {
        p.target = {
          x: own.pos.x + own.vel.x * 0.3,
          z: own.pos.z + own.vel.z * 0.3,
        };
        p.ai = "pressOpponent";
      } else if (own && own.teamId !== team && ranked[1]?.index === p.index) {
        p.target = {
          x: own.pos.x - dir * 6,
          z: own.pos.z + (p.pos.z > own.pos.z ? 4 : -4),
        };
        p.ai = "markOpponent";
      } else if (attack && p.slot >= 8 && p.energy > 20) {
        p.target.x = clamp(
          p.target.x + dir * (5 + tac.transitionSpeed * 6),
          -49,
          49,
        );
        p.ai = "makeRun";
      }
      if (
        !attack &&
        c.losingTeam === team &&
        c.time - c.lastLoss < 1 + tac.pressingIntensity * 3 &&
        ranked.slice(0, 2).includes(p) &&
        p.energy > 20
      ) {
        p.target = { ...c.ball };
        p.ai = "pressOpponent";
      }
    }
  }
}
export function aiDirection(p: Player): Vec {
  const d = distance(p.pos, p.target);
  if (d < 0.5) return { x: 0, z: 0 };
  const n = normalize(p.target.x - p.pos.x, p.target.z - p.pos.z);
  return { x: n.x * Math.min(1, d / 2), z: n.z * Math.min(1, d / 2) };
}
