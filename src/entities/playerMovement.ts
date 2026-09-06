import type { Player, Vec } from "../game/types";
import { angleLerp, clamp, normalize } from "../game/math";
import { stamina } from "../systems/RulesSystem";
export function movePlayer(
  p: Player,
  direction: Vec,
  sprint: boolean,
  owner: boolean,
  dt: number,
  protect = false,
) {
  const magnitude = Math.min(1, Math.hypot(direction.x, direction.z));
  const dir = normalize(direction.x, direction.z),
    speed = Math.hypot(p.vel.x, p.vel.z);
  const facing = { x: Math.sin(p.angle), z: Math.cos(p.angle) };
  const turn = facing.x * dir.x + facing.z * dir.z;
  const cap =
    (3.9 + p.stats.speed * 0.035) *
    (sprint ? 1.3 : 0.83) *
    (0.62 + p.energy * 0.0038) *
    (owner ? 0.86 : 1) *
    (protect ? 0.55 : 1) *
    (turn < -0.3 ? 0.55 : 1);
  const k = 1 - Math.exp(-dt * (2.3 + p.stats.acceleration * 0.045));
  p.vel.x += (dir.x * cap * magnitude - p.vel.x) * k;
  p.vel.z += (dir.z * cap * magnitude - p.vel.z) * k;
  if (magnitude > 0.05)
    p.angle = angleLerp(
      p.angle,
      Math.atan2(dir.x, dir.z),
      (dt * (5 + p.stats.agility * 0.045)) / (1 + speed * 0.07),
    );
  p.pos.x = clamp(p.pos.x + p.vel.x * dt, -52, 52);
  p.pos.z = clamp(p.pos.z + p.vel.z * dt, -33.5, 33.5);
  p.energy = stamina(p.energy, speed, sprint, dt, p.stats.stamina);
  if (p.actionTime <= 0)
    p.animation =
      speed < 0.3
        ? p.position === "GK"
          ? "GoalkeeperIdle"
          : "Idle"
        : sprint && speed > 5
          ? "Sprint"
          : speed > 4
            ? "Run"
            : speed > 2
              ? "Jog"
              : "Walk";
}
