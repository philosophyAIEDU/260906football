import * as THREE from "three";
import type { Player } from "../game/types";
import type { Bones } from "./playerBody";
export interface RigState {
  cycle: number;
  duration: number;
  previous: number;
  drift: number;
  /** Previous facing, so the rig can bank into a turn. */
  angle: number;
  turn: number;
}
export const createRigState = (index: number): RigState => ({
  cycle: index * 0.83,
  duration: 0,
  previous: 0,
  drift: index * 1.7,
  angle: 0,
  turn: 0,
});
export interface Context {
  /** Where the ball is, so players watch it rather than stare ahead. */
  ball: { x: number; z: number };
  /** True while this player is the one on the ball. */
  carrying: boolean;
}
export interface RootPose {
  bob: number;
  pitch: number;
  roll: number;
}
const kicks = [
  "Pass",
  "ThroughPass",
  "Cross",
  "Shoot",
  "CurledShot",
  "GoalkeeperKick",
  "ThrowBall",
];
const { clamp, lerp } = THREE.MathUtils;
/**
 * Poses the skeleton for one frame. Every joint is eased toward a target so
 * transitions between running, striking and diving stay continuous without a
 * clip-blending animation system.
 */
export function poseRig(
  bones: Bones,
  player: Player,
  dt: number,
  state: RigState,
  context: Context,
): RootPose {
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const run = clamp(speed / 6.4, 0, 1);
  const sprint = clamp((speed - 5.5) / 3, 0, 1);
  // Lock the gait to ground travel: one cycle covers two steps, and a step
  // grows with speed. Without this the legs turn over far too slowly for the
  // distance covered and the feet skate across the pitch.
  const step = 0.85 + 0.125 * speed;
  state.cycle += dt * (Math.PI * speed) / step + dt * 0.9;
  state.drift += dt;
  const phase = state.cycle;
  // Banking into a change of direction.
  const swing = Math.atan2(
    Math.sin(player.angle - state.angle),
    Math.cos(player.angle - state.angle),
  );
  state.angle = player.angle;
  state.turn = lerp(state.turn, clamp(swing / Math.max(dt, 0.001) * 0.06, -1, 1), 1 - Math.exp(-dt * 6));
  // Action progress, recovered from the countdown the engine owns.
  if (player.actionTime > state.previous + 1e-4)
    state.duration = player.actionTime;
  state.previous = player.actionTime;
  const acting = player.actionTime > 0 && state.duration > 0;
  const progress = acting
    ? clamp(1 - player.actionTime / state.duration, 0, 1)
    : 1;
  const animation = player.animation;
  const keeper = player.slot === 0;
  const kicking = acting && kicks.includes(animation);
  const sliding = acting && (animation === "SlideTackle" || animation === "Fall");
  const heading = acting && animation === "Header";
  const diving = player.dive > 0;
  const celebrating = animation === "Celebrate";
  const idle = run < 0.06 && !acting && !celebrating;
  const pose = { bob: 0, pitch: 0, roll: 0 };
  const rate = 1 - Math.exp(-dt * (acting || diving ? 19 : 12));
  const set = (bone: THREE.Bone, x: number, y = 0, z = 0) => {
    bone.rotation.x = lerp(bone.rotation.x, x, rate);
    bone.rotation.y = lerp(bone.rotation.y, y, rate);
    bone.rotation.z = lerp(bone.rotation.z, z, rate);
  };
  const breath = Math.sin(state.drift * 1.9) * 0.5 + 0.5;
  // ---- baseline stride --------------------------------------------------
  const legs = [
    { thigh: bones.thighL, shin: bones.shinL, foot: bones.footL, offset: 0 },
    {
      thigh: bones.thighR,
      shin: bones.shinR,
      foot: bones.footR,
      offset: Math.PI,
    },
  ];
  const arms = [
    { upper: bones.armL, fore: bones.foreL, side: 1, offset: 0 },
    { upper: bones.armR, fore: bones.foreR, side: -1, offset: Math.PI },
  ];
  const target = {
    thigh: [0, 0],
    shin: [0, 0],
    foot: [0, 0],
    armX: [0, 0],
    armZ: [0, 0],
    foreX: [0, 0],
    spineX: 0,
    spineY: 0,
    chestX: 0,
    chestY: 0,
    headX: 0,
    headY: 0,
    hipsY: 0,
    hipsZ: 0,
  };
  for (let i = 0; i < 2; i++) {
    const w = phase + legs[i].offset;
    target.thigh[i] = -Math.sin(w) * (0.05 + 0.67 * run) + (idle ? 0.03 : 0);
    target.shin[i] =
      0.06 + (0.06 + 1.3 * run) * (0.5 - 0.5 * Math.cos(w + 0.95));
    // Through the stance half of the cycle the sole is held flat against the
    // pitch, which is what stops the feet looking like they slide.
    const stance = clamp(-Math.sin(w) * 1.6, 0, 1);
    const flat = clamp(-(target.thigh[i] + target.shin[i]), -0.7, 0.4);
    target.foot[i] = lerp(-0.1 + 0.26 * run, flat, stance * run);
    target.armX[i] = Math.sin(w) * (0.05 + 0.72 * run);
    target.armZ[i] = 0.075 + 0.11 * run + (context.carrying ? 0.14 : 0);
    target.foreX[i] = -(0.42 + 0.62 * run + 0.24 * Math.sin(w));
  }
  // Pelvic list and a lean into the turn.
  target.hipsZ = -Math.sin(phase) * 0.06 * run;
  pose.roll = -state.turn * 0.16 * run;
  target.spineX = 0.04 + 0.19 * run + 0.13 * sprint + (idle ? breath * 0.02 : 0);
  target.chestY = -Math.sin(phase) * 0.14 * run;
  target.hipsY = Math.sin(phase) * 0.12 * run;
  target.headX = -(0.04 + 0.2 * run + 0.1 * sprint);
  // Watch the ball rather than staring straight ahead.
  const toBall = Math.atan2(
    context.ball.x - player.pos.x,
    context.ball.z - player.pos.z,
  );
  const relative = Math.atan2(
    Math.sin(toBall - player.angle),
    Math.cos(toBall - player.angle),
  );
  target.headY = clamp(relative, -0.85, 0.85) - target.chestY * 0.5;
  pose.bob = Math.abs(Math.sin(phase)) * (0.004 + 0.042 * run);
  // ---- overrides for the current action ---------------------------------
  if (keeper && !acting && !diving) {
    const ready = clamp(1 - run * 2, 0, 1);
    target.thigh[0] = target.thigh[1] = lerp(target.thigh[0], -0.32, ready);
    target.shin[0] = target.shin[1] = lerp(target.shin[0], 0.66, ready);
    target.foot[0] = target.foot[1] = lerp(target.foot[0], -0.32, ready);
    target.armZ[0] = lerp(target.armZ[0], 0.62, ready);
    target.armZ[1] = lerp(target.armZ[1], 0.62, ready);
    target.armX[0] = target.armX[1] = lerp(target.armX[0], -0.45, ready);
    target.foreX[0] = target.foreX[1] = lerp(target.foreX[0], -1.15, ready);
    target.spineX = lerp(target.spineX, 0.22, ready);
    pose.bob -= 0.075 * ready;
  }
  if (celebrating) {
    target.armZ[0] = 2.45;
    target.armZ[1] = 2.45;
    target.armX[0] = target.armX[1] = -0.25;
    target.foreX[0] = target.foreX[1] = -0.35;
    target.spineX = -0.12;
    target.headX = 0.16;
  }
  if (kicking) {
    const back = Math.sin(Math.min(1, progress / 0.42) * Math.PI * 0.5);
    const strike = clamp((progress - 0.42) / 0.58, 0, 1);
    const swing = Math.sin(strike * Math.PI * 0.62);
    target.thigh[1] = 0.62 * back - 1.35 * swing;
    target.shin[1] = 1.05 * back * (1 - strike) + 0.06;
    target.foot[1] = -0.34 - 0.2 * swing;
    target.thigh[0] = -0.14 - 0.12 * swing;
    target.shin[0] = 0.24 + 0.1 * swing;
    target.foot[0] = -0.1;
    target.spineX = 0.16 + 0.14 * swing;
    target.chestY = 0.28 * back - 0.42 * swing;
    target.hipsY = 0.18 * back - 0.28 * swing;
    target.armX[0] = -0.85 - 0.3 * swing;
    target.armZ[0] = 0.72;
    target.armX[1] = 0.55;
    target.armZ[1] = -0.42;
    target.foreX[0] = -0.9;
    target.foreX[1] = -0.5;
    pose.bob = 0.01 * swing;
  }
  if (heading) {
    const arc = Math.sin(clamp(progress, 0, 1) * Math.PI);
    target.thigh[0] = target.thigh[1] = -0.55 * arc;
    target.shin[0] = target.shin[1] = 1.05 * arc;
    target.armX[0] = target.armX[1] = -1.1 * arc;
    target.armZ[0] = 0.55;
    target.armZ[1] = 0.55;
    target.spineX = -0.32 * Math.sin(progress * Math.PI * 0.9) + 0.45 * progress;
    target.headX = 0.22 * progress;
    pose.bob = arc * 0.52;
  }
  if (sliding) {
    target.thigh[0] = -1.15;
    target.shin[0] = 0.12;
    target.thigh[1] = -0.35;
    target.shin[1] = 1.5;
    target.armX[0] = 0.95;
    target.armX[1] = 0.7;
    target.armZ[0] = 0.5;
    target.armZ[1] = -0.9;
    target.spineX = 0.18;
    pose.pitch = -1.05;
    pose.bob = -0.5;
  }
  if (diving) {
    const reach = clamp(player.dive * 1.6, 0, 1);
    target.armX[0] = target.armX[1] = -1.9;
    target.armZ[0] = 1.05;
    target.armZ[1] = 1.05;
    target.foreX[0] = target.foreX[1] = -0.15;
    target.thigh[0] = -0.35;
    target.thigh[1] = -0.1;
    target.shin[0] = 0.5;
    target.shin[1] = 0.3;
    target.spineX = -0.15;
    pose.roll = (animation === "GoalkeeperDiveLeft" ? 1 : -1) * 1.32 * reach;
    pose.bob = -0.28 * reach;
  }
  // ---- commit ------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    set(legs[i].thigh, target.thigh[i]);
    set(legs[i].shin, Math.max(0, target.shin[i]));
    set(legs[i].foot, target.foot[i]);
    set(arms[i].upper, target.armX[i], 0, arms[i].side * target.armZ[i]);
    set(arms[i].fore, target.foreX[i]);
  }
  set(bones.hips, 0, target.hipsY, target.hipsZ);
  set(bones.spine, target.spineX * 0.55, target.spineY);
  set(bones.chest, target.spineX * 0.45, target.chestY);
  set(bones.neck, target.headX * 0.4, target.headY * 0.4);
  set(bones.head, target.headX * 0.6, target.headY * 0.6);
  return pose;
}
