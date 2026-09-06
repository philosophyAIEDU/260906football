import { beforeAll, describe, it, expect, vi } from "vitest";
import { BALL_RADIUS } from "../systems/RulesSystem";
import RAPIER from "@dimforge/rapier3d-compat";
vi.mock("../systems/AudioSystem", () => ({
  audio: { play: vi.fn(), start: vi.fn(), update: vi.fn() },
}));
import { MatchEngine } from "../game/MatchEngine";
import { defaults } from "../store/settingsStore";
import type { InputFrame } from "../game/types";
const idle: InputFrame = {
  x: 0,
  y: 0,
  sprint: false,
  protect: false,
  press: false,
  teammatePress: false,
  aimX: 0,
  aimY: 0,
  actions: [],
};
beforeAll(async () => {
  await RAPIER.init();
});
function setup() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const floor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.22, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(75, 0.2, 55)
      .setFriction(0.7)
      .setRestitution(0.15),
    floor,
  );
  for (const s of [-1, 1])
    for (const z of [-3.72, 3.72]) {
      const post = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(s * 52.5, 1.25, z),
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.06, 1.25, 0.06), post);
    }
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, BALL_RADIUS + 0.02, 0)
      .setCcdEnabled(true)
      .setLinearDamping(0.08)
      .setAngularDamping(0.4),
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setMass(0.43)
      .setFriction(0.6)
      .setRestitution(0.42),
    ball,
  );
  const g = new MatchEngine();
  g.attachBall(ball);
  g.start({ ...defaults, halfMinutes: 1 });
  const bodies = g.players.map((p) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        p.pos.x,
        0.87,
        p.pos.z,
      ),
    );
    world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3)
        .setFriction(0.2)
        .setRestitution(0.08),
      body,
    );
    return body;
  });
  const step = (frame = idle) => {
    g.tick(1 / 60, frame);
    for (const p of g.players) {
      bodies[p.index].setEnabled(!p.red);
      bodies[p.index].setNextKinematicTranslation({
        x: p.pos.x,
        y: 0.87,
        z: p.pos.z,
      });
    }
    if (!["paused", "halftime", "finished"].includes(g.phase)) world.step();
  };
  return { g, world, ball, step };
}
describe("real Rapier integration", () => {
  it("simulates both halves, AI passes and rule restarts without invalid positions", () => {
    const { g, world, step } = setup();
    let halftime = false;
    for (let i = 0; i < 24000 && g.phase !== "finished"; i++) {
      step();
      if (g.phase === "halftime") {
        halftime = true;
        g.secondHalf();
      }
      if (i % 300 === 0) {
        expect(Number.isFinite(g.ball.x + g.ball.y + g.ball.z)).toBe(true);
        expect(
          g.players.every(
            (p) =>
              Number.isFinite(p.pos.x + p.pos.z) &&
              Math.abs(p.pos.x) < 54 &&
              Math.abs(p.pos.z) < 35,
          ),
        ).toBe(true);
      }
    }
    expect(halftime).toBe(true);
    expect(g.phase).toBe("finished");
    expect(g.stats[0].passes + g.stats[1].passes).toBeGreaterThan(4);
    expect(g.stats[0].possession + g.stats[1].possession).toBeGreaterThan(2);
    console.info(
      "Simulation counters",
      JSON.stringify({
        score: g.score,
        passes: g.stats.map((s) => s.passes),
        shots: g.stats.map((s) => s.shots),
        corners: g.stats.map((s) => s.corners),
        offsides: g.stats.map((s) => s.offsides),
        completed: g.stats.map((s) => s.completed),
      }),
    );
    world.free();
  }, 20000);
  it("keeps a dribbled ball close with capsule collisions enabled", () => {
    const { g, world, step } = setup();
    g.phase = "playing";
    g.restart = null;
    const p = g.players[9];
    p.pos = { x: 0, z: 0 };
    p.angle = Math.PI / 2;
    g.selected = 9;
    g.resetBall({ x: 0.8, z: 0 });
    g.acquire(p);
    for (let i = 0; i < 90; i++) step({ ...idle, x: 1 });
    expect(p.pos.x).toBeGreaterThan(2);
    expect(Math.hypot(g.ball.x - p.pos.x, g.ball.z - p.pos.z)).toBeLessThan(
      3.2,
    );
    world.free();
  });
  it("moves right and left correctly in broadcast and rotated views", () => {
    for (const forward of [
      { x: 0, z: -1 },
      { x: 1, z: 0 },
      { x: -1, z: 0 },
    ]) {
      const { g, world, step } = setup();
      g.phase = "playing";
      g.forward = forward;
      const p = g.players[g.selected];
      p.pos = { x: 0, z: 0 };
      const origin = { ...p.pos };
      for (let i = 0; i < 60; i++) step({ ...idle, x: 1 });
      expect(
        (p.pos.x - origin.x) * -forward.z + (p.pos.z - origin.z) * forward.x,
      ).toBeGreaterThan(1);
      world.free();
    }
  });
  it("releases a shot that travels toward goal and cannot instantly reattach", () => {
    const { g, world, step, ball } = setup();
    g.phase = "playing";
    g.restart = null;
    const p = g.players[9];
    p.pos = { x: 35, z: 0 };
    p.angle = Math.PI / 2;
    g.resetBall({ x: 35.8, z: 0 });
    g.acquire(p);
    step({ ...idle, actions: [{ key: "KeyF", power: 0.65 }] });
    expect(g.owner).toBeNull();
    expect(ball.linvel().x).toBeGreaterThan(20);
    expect(g.stats[0].shots).toBe(1);
    world.free();
  });
});
