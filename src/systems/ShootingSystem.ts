import type { MatchEngine } from "../game/MatchEngine";
import type { Player, Vec } from "../game/types";
import { clamp, distance, normalize } from "../game/math";
import { difficulty } from "../ai/decisionScoring";
import { audio } from "./AudioSystem";
export function shootBall(
  g: MatchEngine,
  p: Player,
  key: string,
  power: number,
  aim: Vec,
  manualAim: boolean,
  header = false,
) {
  if (!g.body) return;
  const dir = g.dir(p.teamId),
    goal = { x: 52.5 * dir, z: 0 };
  const d = distance(p.pos, goal);
  const nearDef = g.players.filter(
    (o) => o.teamId !== p.teamId && !o.red && distance(o.pos, p.pos) < 3,
  ).length;
  const rating = d < 18 ? p.stats.finishing : p.stats.shooting;
  const accuracy =
    p.index === g.selected ? 1 : difficulty[g.settings.difficulty].accuracy;
  const error =
    ((g.random() - 0.5) *
      ((100 - rating) * 0.1 +
        nearDef * 0.6 +
        (power > 1 ? (power - 1) * 12 : 0))) /
    accuracy;
  let target = {
    x: goal.x,
    z: clamp(p.pos.z * 0.06 + (g.random() - 0.5) * 4 + error, -7, 7),
  };
  if (manualAim) {
    const scale = d / Math.max(0.3, Math.abs(aim.x));
    target = { x: p.pos.x + aim.x * scale, z: p.pos.z + aim.z * scale };
    if (d < 22 && Math.abs(target.z) < 9) target.z = target.z * 0.55;
  }
  const n = normalize(target.x - p.pos.x, target.z - p.pos.z);
  const low = key === "KeyX";
  const speed =
    (header ? 14 : 18) +
    clamp(power, 0, 1.4) * (header ? 6 : 14) +
    (header ? p.stats.heading : p.stats.shooting) * 0.025;
  const y = header
    ? 1.1
    : low
      ? 0.65
      : 1 +
        clamp(power, 0, 1) * 2.6 +
        (d > 23 ? 1.3 : 0) +
        (power > 1 ? (power - 1) * 14 : 0);
  g.release(p, { x: n.x * speed, y, z: n.z * speed }, 0.75);
  if (key === "KeyZ") {
    g.spin = dir * 7;
    g.body.setAngvel({ x: 0, y: dir * 24, z: 0 }, true);
  }
  g.stats[p.teamId].shots++;
  const targetY = g.ball.y + y * (d / speed) - 4.905 * (d / speed) ** 2;
  const onTarget = Math.abs(target.z) < 3.44 && targetY < 2.22;
  if (onTarget) g.stats[p.teamId].onTarget++;
  g.shot = { team: p.teamId, player: p.index, onTarget };
  g.pendingPass = null;
  g.receiver = null;
  g.offside.clear();
  p.animation = header ? "Header" : key === "KeyZ" ? "CurledShot" : "Shoot";
  p.actionTime = 0.55;
  audio.play("shot");
}
