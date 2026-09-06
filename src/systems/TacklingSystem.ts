import type { MatchEngine } from "../game/MatchEngine";
import type { Player } from "../game/types";
import { distance, normalize, dot } from "../game/math";
import { isPenalty } from "./RulesSystem";
import { audio } from "./AudioSystem";
export function tackle(g: MatchEngine, p: Player, slide: boolean) {
  if (p.cooldown > 0) return;
  const owner = g.owner === null ? null : g.players[g.owner];
  p.cooldown = slide ? 1.9 : 0.9;
  p.actionTime = slide ? 0.95 : 0.38;
  p.animation = slide ? "SlideTackle" : "Tackle";
  g.stats[p.teamId].tackles++;
  if (!owner || owner.teamId === p.teamId) return;
  const d = distance(p.pos, owner.pos);
  if (d > (slide ? 2.9 : 1.85)) return;
  const toward = normalize(p.pos.x - owner.pos.x, p.pos.z - owner.pos.z);
  const behind =
    dot(toward, { x: Math.sin(owner.angle), z: Math.cos(owner.angle) }) < -0.25;
  const ballDistance = distance(p.pos, g.ball);
  const contactBall =
    ballDistance < (slide ? 2.8 : 1.6) && (!behind || ballDistance < d - 0.15);
  const chance =
    0.4 +
    p.stats.tackling * 0.004 +
    (p.stats.strength - owner.stats.balance) * 0.003 -
    (g.protectedOwner ? 0.2 : 0);
  if (contactBall && g.random() < chance) {
    g.owner = null;
    g.lockUntil = g.time + 0.2;
    g.body?.applyImpulse(
      { x: toward.x * 1.6, y: 0.13, z: toward.z * 1.6 },
      true,
    );
    g.stats[p.teamId].tacklesWon++;
    g.lastTouch = p.index;
    audio.play("tackle");
    return;
  }
  if (!contactBall && (slide || behind) && d < 2.1) {
    g.stats[p.teamId].fouls++;
    let card = "";
    if (
      slide &&
      behind &&
      Math.hypot(p.vel.x - owner.vel.x, p.vel.z - owner.vel.z) > 8
    ) {
      p.red = true;
      g.stats[p.teamId].reds++;
      card = " · 위험한 태클, 퇴장";
    } else if (slide && behind) {
      p.yellow++;
      g.stats[p.teamId].yellows++;
      card = " · 옐로카드";
      if (p.yellow >= 2) {
        p.red = true;
        g.stats[p.teamId].reds++;
        card = " · 두 번째 경고, 퇴장";
      }
    }
    g.addEvent("card", `${p.name} 파울${card}`, p.index);
    const spot = { ...owner.pos };
    g.prepareRestart(
      isPenalty(spot, g.dir(owner.teamId)) ? "penalty" : "freeKick",
      owner.teamId,
      spot,
    );
    g.notice = `파울${card}`;
    audio.play("whistle");
  }
}
