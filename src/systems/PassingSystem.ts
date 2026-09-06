import type { MatchEngine } from "../game/MatchEngine";
import type { Player, Vec } from "../game/types";
import { passScore } from "../ai/decisionScoring";
import { clamp, distance, normalize } from "../game/math";
import { offsideCandidates } from "./RulesSystem";
import { audio } from "./AudioSystem";
export function passBall(
  g: MatchEngine,
  p: Player,
  key: string,
  power: number,
  aim: Vec,
) {
  if (!g.body) return;
  const dir = g.dir(p.teamId),
    long = key === "KeyQ",
    through = key === "KeyE";
  const candidates = g.players.filter(
    (t) => t.teamId === p.teamId && t.index !== p.index && !t.red,
  );
  const off = offsideCandidates(g.players, p.teamId, g.ball, dir);
  const target = candidates
    .sort(
      (a, b) =>
        passScore(p, b, aim, g.players, dir) -
        passScore(p, a, aim, g.players, dir),
    )
    .find((t) => p.index === g.selected || !off.includes(t.index));
  let destination = {
    x: p.pos.x + aim.x * (12 + power * 25),
    z: p.pos.z + aim.z * (12 + power * 25),
  };
  if (target && (p.index !== g.selected || g.settings.passAssist !== "low")) {
    const ahead = through ? 8 : 0;
    const assisted = {
      x: target.pos.x + target.vel.x * 0.6 + dir * ahead,
      z: target.pos.z + target.vel.z * 0.6,
    };
    const weight =
      p.index !== g.selected || g.settings.passAssist === "high" ? 1 : 0.65;
    destination = {
      x: destination.x * (1 - weight) + assisted.x * weight,
      z: destination.z * (1 - weight) + assisted.z * weight,
    };
  }
  const d = distance(p.pos, destination);
  const n = normalize(destination.x - p.pos.x, destination.z - p.pos.z);
  const error =
    (g.random() - 0.5) *
    (100 - (long ? p.stats.crossing : p.stats.passing)) *
    0.0015;
  const speed = long
    ? clamp(d * 0.68, 15, 31)
    : clamp(9 + d * 0.43 + power * 4, 11, 29);
  g.release(
    p,
    {
      x: (n.x + error) * speed,
      y: long ? clamp(d * 0.22, 5, 11) : 0.5,
      z: (n.z - error) * speed,
    },
    0.65,
  );
  g.stats[p.teamId].passes++;
  g.pendingPass = { from: p.index, to: target?.index ?? null, team: p.teamId };
  g.receiver = target?.index ?? null;
  g.offside = g.settings.offside && !g.exemptOffside ? new Set(off) : new Set();
  g.exemptOffside = false;
  p.animation = long ? "Cross" : through ? "ThroughPass" : "Pass";
  p.actionTime = 0.45;
  audio.play("kick");
}
