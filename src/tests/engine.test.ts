import { describe, it, expect, vi } from "vitest";
vi.mock("../systems/AudioSystem", () => ({
  audio: { play: vi.fn(), start: vi.fn(), update: vi.fn() },
}));
import { tackle } from "../systems/TacklingSystem";
import { MatchEngine } from "../game/MatchEngine";
import { defaults } from "../store/settingsStore";
import type { BallBody, Vec3, InputFrame } from "../game/types";
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
class FakeBall implements BallBody {
  p = { x: 0, y: 0.24, z: 0 };
  v = { x: 0, y: 0, z: 0 };
  translation() {
    return this.p;
  }
  linvel() {
    return this.v;
  }
  setTranslation(v: Vec3) {
    this.p = { ...v };
  }
  setLinvel(v: Vec3) {
    this.v = { ...v };
  }
  setAngvel() {}
  applyImpulse(v: Vec3) {
    this.v = { x: this.v.x + v.x, y: this.v.y + v.y, z: this.v.z + v.z };
  }
}
const game = () => {
  const g = new MatchEngine();
  g.attachBall(new FakeBall());
  g.start({ ...defaults, muted: true });
  g.phase = "playing";
  return g;
};
describe("match integration", () => {
  it("counts a goal once then restarts for the conceding team", () => {
    const g = game();
    g.goal(0);
    g.goal(0);
    expect(g.score).toEqual([1, 0]);
    for (let i = 0; i < 220; i++) g.tick(1 / 60, idle);
    expect(g.phase).toBe("kickoff");
    expect(g.restart?.team).toBe(1);
    expect(g.score).toEqual([1, 0]);
  });
  it("pauses clock and resumes previous phase", () => {
    const g = game();
    g.elapsed = 10;
    g.pause();
    g.tick(1, idle);
    expect(g.elapsed).toBe(10);
    expect(g.phase).toBe("paused");
    g.pause();
    expect(g.phase).toBe("playing");
  });
  it("halftime flips direction and recovers stamina once", () => {
    const g = game();
    g.elapsed = 300;
    g.tick(1 / 60, idle);
    expect(g.phase).toBe("halftime");
    const dir = g.dir(0);
    g.players[1].energy = 50;
    g.secondHalf();
    expect(g.dir(0)).toBe(-dir);
    expect(g.half).toBe(2);
    expect(g.elapsed).toBe(0);
    expect(g.players[1].energy).toBe(72);
    g.secondHalf();
    expect(g.players[1].energy).toBe(72);
  });
  it("finishes second half including draw", () => {
    const g = game();
    g.half = 2;
    g.elapsed = 300;
    g.tick(1 / 60, idle);
    expect(g.phase).toBe("finished");
    expect(g.score).toEqual([0, 0]);
  });
  it("restarts set pieces exactly once with input after setup", () => {
    const g = game();
    g.prepareRestart("corner", 0, { x: 52, z: 33.5 });
    const corners = g.stats[0].corners;
    for (let i = 0; i < 125; i++) g.tick(1 / 60, idle);
    g.tick(1 / 60, { ...idle, actions: [{ key: "KeyQ", power: 0.5 }] });
    expect(g.phase).toBe("playing");
    expect(g.restart).toBeNull();
    expect(g.stats[0].corners).toBe(corners);
    expect(g.stats[0].passes).toBe(1);
    expect(g.body!.linvel().y).toBeGreaterThan(4);
  });
  it("offside snapshot is only penalized upon involvement", () => {
    const g = game();
    g.offside.add(9);
    g.offsideSpots.set(9, { x: 40, z: 0 });
    expect(g.phase).toBe("playing");
    g.players[9].pos.x = 10;
    g.acquire(g.players[9]);
    expect(g.stats[0].offsides).toBe(1);
    expect(g.restart?.kind).toBe("indirect");
    expect(g.restart?.spot.x).toBe(40);
  });
  it("opponent control cancels offside and incomplete pass", () => {
    const g = game();
    g.offside.add(9);
    g.pendingPass = { from: 8, to: 9, team: 0 };
    g.acquire(g.players[12]);
    expect(g.offside.size).toBe(0);
    expect(g.stats[0].completed).toBe(0);
    expect(g.owner).toBe(12);
  });
  it("pass completion and assists use real reception", () => {
    const g = game();
    g.pendingPass = { from: 8, to: 9, team: 0 };
    g.acquire(g.players[9]);
    expect(g.stats[0].completed).toBe(1);
    g.goal(0);
    expect(g.players[8].assists).toBe(1);
    expect(g.players[9].goals).toBe(1);
  });
  it("sent off players stay excluded after restart", () => {
    const g = game();
    g.players[9].red = true;
    g.prepareRestart("kickoff", 0, { x: 0, z: 0 });
    expect(g.restart?.taker).not.toBe(9);
    expect(g.players[9].red).toBe(true);
  });
  it("new match clears score cards events and pending possession", () => {
    const g = game();
    g.goal(0);
    g.players[2].red = true;
    g.start(defaults);
    expect(g.score).toEqual([0, 0]);
    expect(g.events).toHaveLength(0);
    expect(g.players.some((p) => p.red)).toBe(false);
    expect(g.owner).toBeNull();
    expect(g.pendingPass).toBeNull();
  });
});

describe("discipline and direct restarts", () => {
  const foul = (g: MatchEngine, speed = 0) => {
    const attacker = g.players[9],
      defender = g.players[12];
    g.phase = "playing";
    g.restart = null;
    attacker.pos = { x: 40, z: 0 };
    attacker.angle = Math.PI / 2;
    attacker.vel = { x: 0, z: 0 };
    defender.pos = { x: 38.5, z: 0 };
    defender.vel = { x: speed, z: 0 };
    defender.cooldown = 0;
    g.owner = attacker.index;
    g.resetBall({ x: 40.8, z: 0 });
    tackle(g, defender, true);
  };
  it("awards penalty for a foul inside the penalty area", () => {
    const g = game();
    foul(g);
    expect(g.restart?.kind).toBe("penalty");
    expect(g.restart?.team).toBe(0);
    expect(g.players[12].yellow).toBe(1);
    expect(g.stats[1].fouls).toBe(1);
  });
  it("dismisses player after second yellow", () => {
    const g = game();
    foul(g);
    foul(g);
    expect(g.players[12].red).toBe(true);
    expect(g.stats[1].yellows).toBe(2);
    expect(g.stats[1].reds).toBe(1);
  });
  it("dismisses a dangerous high-speed rear slide directly", () => {
    const g = game();
    foul(g, 10);
    expect(g.players[12].red).toBe(true);
    expect(g.stats[1].reds).toBe(1);
    expect(g.stats[1].yellows).toBe(0);
  });
  it("does not score directly from an indirect restart", () => {
    const g = game();
    g.protectedRestart = { kind: "indirect", team: 0, taker: 9 };
    g.lastTouch = 9;
    g.ball = { x: 52, y: 0.3, z: 0 };
    g.body!.setTranslation({ x: 53, y: 0.3, z: 0 }, true);
    g.tick(1 / 60, idle);
    expect(g.score).toEqual([0, 0]);
    expect(g.restart?.kind).toBe("goalKick");
  });
});

describe("automatic controlled player switching", () => {
  it("switches immediately to a home teammate receiving the ball", () => {
    const g = game();
    g.selected = 9;
    g.acquire(g.players[6]);
    expect(g.selected).toBe(6);
    expect(g.owner).toBe(6);
  });
  it("does not switch to opponents", () => {
    const g = game();
    g.selected = 9;
    g.acquire(g.players[15]);
    expect(g.selected).toBe(9);
  });
  it("supports the away team and its goalkeeper", () => {
    const g = game();
    g.settings.team = 1;
    g.selected = 20;
    g.acquire(g.players[11]);
    expect(g.selected).toBe(11);
  });
  it("does not switch to an offside receiver", () => {
    const g = game();
    g.selected = 6;
    g.offside.add(9);
    g.acquire(g.players[9]);
    expect(g.selected).toBe(6);
    expect(g.owner).toBeNull();
  });
});
