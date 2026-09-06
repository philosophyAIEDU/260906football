import { describe, it, expect } from "vitest";
import {
  boundary,
  offsideCandidates,
  isPenalty,
  halfExpired,
  nextHalf,
  stamina,
} from "../systems/RulesSystem";
import { cameraRelative } from "../game/math";
import { createPlayers } from "../data/teams";
import { formationTarget, formations, tactics } from "../ai/formations";
import {
  passScore,
  shotScore,
  switchTarget,
  difficulty,
} from "../ai/decisionScoring";
import {
  emptyStats,
  percent,
  possessionPercent,
} from "../systems/StatisticsSystem";
describe("whole-ball boundaries", () => {
  it("waits for the whole ball to cross the line", () => {
    expect(
      boundary({ x: 52, y: 0.3, z: 0 }, { x: 52.6, y: 0.3, z: 0 }, 0, 1),
    ).toBeNull();
    expect(
      boundary({ x: 52, y: 0.3, z: 0 }, { x: 52.73, y: 0.3, z: 0 }, 0, 1),
    ).toEqual({ kind: "goal", team: 0 });
  });
  it("rejects high and wide shots", () => {
    expect(
      boundary({ x: 52, y: 2.4, z: 0 }, { x: 53, y: 2.4, z: 0 }, 0, 1)?.kind,
    ).toBe("goalKick");
    expect(
      boundary({ x: 52, y: 1, z: 3.6 }, { x: 53, y: 1, z: 3.6 }, 0, 1)?.kind,
    ).toBe("goalKick");
  });
  it("uses the crossing point for fast balls", () =>
    expect(
      boundary({ x: 52, y: 1, z: 0 }, { x: 55, y: 5, z: 0 }, 0, 1)?.kind,
    ).toBe("goal"));
  it("changes scoring direction after halftime", () =>
    expect(
      boundary({ x: -52, y: 0.3, z: 0 }, { x: -53, y: 0.3, z: 0 }, 0, -1),
    ).toEqual({ kind: "goal", team: 0 }));
  it("awards corner after defender touch", () =>
    expect(
      boundary({ x: 52, y: 1, z: 10 }, { x: 53, y: 1, z: 10 }, 1, 1),
    ).toMatchObject({ kind: "corner", team: 0 }));
  it("awards goal kick after attacker touch", () =>
    expect(
      boundary({ x: 52, y: 1, z: 10 }, { x: 53, y: 1, z: 10 }, 0, 1),
    ).toMatchObject({ kind: "goalKick", team: 1 }));
  it("awards throw-in to opposite team only after whole ball out", () => {
    expect(
      boundary({ x: 10, y: 0.3, z: 34 }, { x: 10, y: 0.3, z: 34.1 }, 0, 1),
    ).toBeNull();
    expect(
      boundary({ x: 10, y: 0.3, z: 34 }, { x: 10, y: 0.3, z: 34.3 }, 0, 1),
    ).toMatchObject({ kind: "throwIn", team: 1 });
  });
});
describe("offside", () => {
  const scene = () => {
    const p = createPlayers();
    p.forEach((t) => (t.pos = { x: t.teamId === 0 ? 10 : 30, z: 0 }));
    p[11].pos.x = 51;
    p[9].pos.x = 40;
    return p;
  };
  it("flags attacker beyond ball and second last defender", () =>
    expect(offsideCandidates(scene(), 0, { x: 20, z: 0 }, 1)).toContain(9));
  it("allows level attackers", () => {
    const p = scene();
    p[9].pos.x = 30;
    expect(offsideCandidates(p, 0, { x: 20, z: 0 }, 1)).not.toContain(9);
  });
  it("allows attackers behind the ball", () =>
    expect(offsideCandidates(scene(), 0, { x: 45, z: 0 }, 1)).not.toContain(9));
  it("exempts own half", () => {
    const p = scene();
    p.forEach((t) => (t.pos.x = -Math.abs(t.pos.x)));
    expect(offsideCandidates(p, 0, { x: -45, z: 0 }, 1)).toHaveLength(0);
  });
  it("uses reversed direction", () => {
    const p = scene();
    p.forEach((t) => (t.pos.x *= -1));
    expect(offsideCandidates(p, 0, { x: -20, z: 0 }, -1)).toContain(9);
  });
});
describe("match state and fitness", () => {
  it("has 22 unique players, two keepers and eleven per team", () => {
    const p = createPlayers();
    expect(p).toHaveLength(22);
    expect(new Set(p.map((t) => t.id)).size).toBe(22);
    expect(p.filter((t) => t.teamId === 0)).toHaveLength(11);
    expect(p.filter((t) => t.position === "GK")).toHaveLength(2);
  });
  it("recognizes both penalty areas", () => {
    expect(isPenalty({ x: 40, z: 4 }, 1)).toBe(true);
    expect(isPenalty({ x: -40, z: 4 }, -1)).toBe(true);
    expect(isPenalty({ x: 40, z: 23 }, 1)).toBe(false);
  });
  it("ends halves at configured time", () => {
    expect(halfExpired(299.9, 5)).toBe(false);
    expect(halfExpired(300, 5)).toBe(true);
    expect(nextHalf(1)).toBe("halftime");
    expect(nextHalf(2)).toBe("finished");
  });
  it("drains sprint stamina and recovers while resting", () => {
    expect(stamina(50, 7, true, 1)).toBeLessThan(50);
    expect(stamina(50, 0, false, 1)).toBeGreaterThan(50);
    expect(stamina(100, 0, false, 20)).toBe(100);
    expect(stamina(0, 8, true, 20)).toBe(0);
  });
});
describe("controls and AI", () => {
  it.each([
    { x: 0, z: -1 },
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0.5, z: -0.5 },
  ])("camera-relative up and right stay perpendicular (%j)", (f) => {
    const up = cameraRelative(0, 1, f),
      right = cameraRelative(1, 0, f);
    expect(up.x * f.x + up.z * f.z).toBeGreaterThan(0);
    expect(up.x * right.x + up.z * right.z).toBeCloseTo(0);
    expect(right.x * -up.z + right.z * up.x).toBeCloseTo(1);
  });
  it("keeps diagonal speed normalized", () =>
    expect(
      Math.hypot(...Object.values(cameraRelative(1, 1, { x: 0, z: -1 }))),
    ).toBeCloseTo(1));
  it("all formations have eleven distinct targets within pitch", () => {
    for (const key of Object.keys(formations) as (keyof typeof formations)[]) {
      const positions = formations[key].map((_, i) =>
        formationTarget(i, key, 1, { x: 30, z: 20 }, true, tactics.attacking),
      );
      expect(new Set(positions.map((p) => `${p.x},${p.z}`)).size).toBe(11);
      positions.forEach((p) => {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(49);
        expect(Math.abs(p.z)).toBeLessThan(34);
      });
    }
  });
  it("possession changes team shape", () =>
    expect(
      formationTarget(8, "4-3-3", 1, { x: 0, z: 0 }, true, tactics.balanced).x,
    ).toBeGreaterThan(
      formationTarget(8, "4-3-3", 1, { x: 0, z: 0 }, false, tactics.balanced).x,
    ));
  it("prefers clear pass lanes", () => {
    const p = createPlayers();
    p[0].pos = { x: 0, z: 0 };
    p[1].pos = { x: 15, z: 0 };
    p.forEach((t, i) => {
      if (i > 1) t.pos = { x: 40, z: 30 };
    });
    const free = passScore(p[0], p[1], { x: 1, z: 0 }, p, 1);
    p[11].pos = { x: 8, z: 0 };
    expect(passScore(p[0], p[1], { x: 1, z: 0 }, p, 1)).toBeLessThan(free);
  });
  it("scores close shooting positions higher", () => {
    const p = createPlayers();
    p[9].pos = { x: 40, z: 0 };
    const close = shotScore(p[9], p, 1);
    p[9].pos.x = 0;
    expect(close).toBeGreaterThan(shotScore(p[9], p, 1));
  });
  it("switches to eligible teammate and excludes sent off players", () => {
    const p = createPlayers();
    p[1].pos = { x: 5, z: 0 };
    p[2].pos = { x: 6, z: 0 };
    p[1].red = true;
    const target = switchTarget(p, 0, 9, { x: 5, z: 0 }, { x: 0, z: 0 }, 2);
    expect(target).toBe(2);
  });
  it("hard mode improves judgment interval without changing player speed", () => {
    expect(difficulty.hard.interval).toBeLessThan(difficulty.easy.interval);
    expect(difficulty.hard.accuracy).toBeGreaterThan(difficulty.easy.accuracy);
    expect(difficulty.hard).not.toHaveProperty("speed");
  });
  it("calculates statistics from event counters without NaN", () => {
    const a = emptyStats(),
      b = emptyStats();
    expect(possessionPercent(a, b)).toBe(50);
    a.possession = 30;
    b.possession = 10;
    expect(possessionPercent(a, b)).toBe(75);
    expect(percent(7, 10)).toBe(70);
    expect(percent(0, 0)).toBe(0);
  });
});
