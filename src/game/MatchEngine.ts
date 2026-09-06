import type {
  Settings,
  MatchPhase,
  Player,
  TeamId,
  Vec,
  Vec3,
  BallBody,
  Restart,
  RestartKind,
  MatchEvent,
  InputFrame,
  TeamStats,
} from "./types";
import { createPlayers } from "../data/teams";
import { defaults } from "../store/settingsStore";
import { useMatch } from "../store/matchStore";
import { emptyStats } from "../systems/StatisticsSystem";
import { formationTarget, tactics } from "../ai/formations";
import { updateTeamAI, aiDirection } from "../ai/TeamAI";
import {
  difficulty,
  passScore,
  shotScore,
  switchTarget,
} from "../ai/decisionScoring";
import { SpatialIndex } from "../ai/spatialIndex";
import { cameraRelative, clamp, distance, normalize } from "./math";
import { movePlayer } from "../entities/playerMovement";
import { boundary, halfExpired, nextHalf } from "../systems/RulesSystem";
import { passBall } from "../systems/PassingSystem";
import { shootBall } from "../systems/ShootingSystem";
import { tackle } from "../systems/TacklingSystem";
import { audio } from "../systems/AudioSystem";
import { input } from "../systems/InputSystem";
const labels: Record<RestartKind, string> = {
  kickoff: "킥오프",
  throwIn: "스로인",
  goalKick: "골킥",
  corner: "코너킥",
  freeKick: "프리킥",
  indirect: "간접 프리킥",
  penalty: "페널티킥",
};
export class MatchEngine {
  players: Player[] = createPlayers();
  settings: Settings = { ...defaults };
  phase: MatchPhase = "menu";
  previousPhase: MatchPhase = "playing";
  half: 1 | 2 = 1;
  elapsed = 0;
  time = 0;
  score: [number, number] = [0, 0];
  stats: [TeamStats, TeamStats] = [emptyStats(), emptyStats()];
  events: MatchEvent[] = [];
  selected = 9;
  owner: number | null = null;
  lastTouch = 9;
  ball: Vec3 = { x: 0, y: 0.22, z: 0 };
  ballVelocity: Vec3 = { x: 0, y: 0, z: 0 };
  previousBall: Vec3 = { x: 0, y: 0.22, z: 0 };
  body: BallBody | null = null;
  restart: Restart | null = null;
  timer = 0;
  notice = "";
  forward: Vec = { x: 0, z: -1 };
  receiver: number | null = null;
  pendingPass: { from: number; to: number | null; team: TeamId } | null = null;
  offside = new Set<number>();
  offsideSpots = new Map<number, Vec>();
  shot: { team: TeamId; player: number; onTarget: boolean } | null = null;
  lockUntil = 0;
  releaser = -1;
  reacquireAt = 0;
  touchAt = 0;
  ownedSince = 0;
  spin = 0;
  exemptOffside = false;
  protectedOwner = false;
  lastLoss = 0;
  losingTeam: TeamId | null = null;
  assist: { player: number; team: TeamId; at: number } | null = null;
  lastOwnerTeam: TeamId | null = null;
  grid = new SpatialIndex();
  uiAt = 0;
  randomSeed = 52309;
  cameraMode: 0 | 1 | 2 = 0;
  fps = 60;
  random() {
    this.randomSeed = (1664525 * this.randomSeed + 1013904223) >>> 0;
    return this.randomSeed / 4294967296;
  }
  dir(team: TeamId) {
    return (team === 0 ? 1 : -1) * (this.half === 1 ? 1 : -1);
  }
  constructor() {
    this.placeFormation();
  }
  placeFormation() {
    for (const p of this.players) {
      p.pos = formationTarget(
        p.slot,
        p.teamId === this.settings.team ? this.settings.formation : "4-3-3",
        this.dir(p.teamId),
        { x: 0, z: 0 },
        false,
        tactics.balanced,
      );
      p.vel = { x: 0, z: 0 };
      p.target = { ...p.pos };
      p.angle = (this.dir(p.teamId) * Math.PI) / 2;
      p.actionTime = 0;
      p.animation = p.slot === 0 ? "GoalkeeperIdle" : "Idle";
    }
  }
  attachBall(body: BallBody) {
    this.body = body;
    this.resetBall(this.ball);
  }
  resetBall(spot: Vec, y = 0.24) {
    this.ball = { ...spot, y };
    this.previousBall = { ...this.ball };
    this.ballVelocity = { x: 0, y: 0, z: 0 };
    this.body?.setTranslation(this.ball, true);
    this.body?.setLinvel(this.ballVelocity, true);
    this.body?.setAngvel(this.ballVelocity, true);
  }
  start(settings: Settings) {
    this.settings = { ...settings };
    this.players = createPlayers();
    this.phase = "preMatch";
    this.half = 1;
    this.elapsed = 0;
    this.time = 0;
    this.score = [0, 0];
    this.stats[0] = emptyStats();
    this.stats[1] = emptyStats();
    this.events = [];
    this.selected = settings.team * 11 + 9;
    this.owner = null;
    this.lastTouch = 9;
    this.restart = null;
    this.protectedRestart = null;
    this.pendingPass = null;
    this.receiver = null;
    this.offside.clear();
    this.offsideSpots.clear();
    this.shot = null;
    this.assist = null;
    this.spin = 0;
    this.lockUntil = 0;
    this.reacquireAt = 0;
    this.lastOwnerTeam = null;
    this.randomSeed = 52309;
    this.cameraMode = settings.camera;
    this.timer = 1.8;
    this.notice = "ROYAL BLUE FC  ·  CRIMSON UNITED";
    this.placeFormation();
    this.resetBall({ x: 0, z: 0 });
    input.clear();
    void audio.start(settings);
    this.publish();
  }
  pause() {
    if (this.phase === "paused") {
      this.phase = this.previousPhase;
    } else if (
      [
        "playing",
        "setPiece",
        "kickoff",
        "preMatch",
        "goal",
        "stopped",
      ].includes(this.phase)
    ) {
      this.previousPhase = this.phase;
      this.phase = "paused";
    }
    input.clear();
    this.publish();
  }
  menu() {
    this.phase = "menu";
    this.owner = null;
    this.restart = null;
    this.notice = "";
    this.placeFormation();
    this.resetBall({ x: 0, z: 0 });
    input.clear();
    this.publish();
  }
  secondHalf() {
    if (this.phase !== "halftime") return;
    this.half = 2;
    this.elapsed = 0;
    for (const p of this.players) p.energy = clamp(p.energy + 22, 0, 100);
    this.prepareRestart("kickoff", 1, { x: 0, z: 0 });
    this.publish();
  }
  addEvent(kind: MatchEvent["kind"], text: string, player?: number) {
    this.events.push({
      kind,
      text,
      minute: Math.floor(
        (this.half - 1) * 45 +
          (this.elapsed / (this.settings.halfMinutes * 60)) * 45,
      ),
      player,
      team: player === undefined ? undefined : this.players[player].teamId,
    });
    this.events = this.events.slice(-50);
  }
  prepareRestart(kind: RestartKind, team: TeamId, spot: Vec) {
    this.owner = null;
    this.receiver = null;
    this.pendingPass = null;
    this.offside.clear();
    this.offsideSpots.clear();
    this.shot = null;
    this.spin = 0;
    this.exemptOffside = ["kickoff", "throwIn", "goalKick", "corner"].includes(
      kind,
    );
    this.placeFormation();
    if (kind === "penalty") spot = { x: 41.5 * this.dir(team), z: 0 };
    let eligible = this.players.filter(
      (p) =>
        p.teamId === team &&
        !p.red &&
        (kind === "goalKick" ? p.slot === 0 : p.slot !== 0),
    );
    if (!eligible.length)
      eligible = this.players.filter((p) => p.teamId === team && !p.red);
    const taker =
      kind === "kickoff"
        ? (eligible.find((p) => p.slot === 9) ?? eligible[0])
        : eligible.sort(
            (a, b) => distance(a.pos, spot) - distance(b.pos, spot),
          )[0];
    if (!taker) {
      this.phase = "finished";
      this.notice = "경기를 계속할 선수가 없습니다";
      return;
    }
    const d = this.dir(team);
    for (const p of this.players) {
      if (p.red || p.index === taker.index) continue;
      if (kind === "kickoff") {
        p.pos.x =
          d *
          (p.teamId === team
            ? -Math.max(3, Math.abs(p.pos.x))
            : Math.max(10, Math.abs(p.pos.x)));
      } else if (kind === "penalty") {
        if (p.teamId !== team && p.slot === 0) p.pos = { x: 51.2 * d, z: 0 };
        else p.pos = { x: clamp(p.pos.x, -34, 34), z: p.pos.z };
      } else if (kind === "corner") {
        if (p.slot >= 8 && p.teamId === team)
          p.pos = { x: (42 + (p.slot - 8) * 2) * d, z: (p.slot - 9) * 5 };
        if (p.slot >= 2 && p.slot <= 4 && p.teamId !== team)
          p.pos = { x: 46 * d, z: (p.slot - 3) * 5 };
      }
      if (distance(p.pos, spot) < (p.teamId === team ? 3 : 9.2)) {
        const n = normalize(p.pos.x - spot.x || -d, p.pos.z - spot.z || 0.2);
        const radius = p.teamId === team ? 3.2 : 9.4;
        p.pos = {
          x: clamp(spot.x + n.x * radius, -51, 51),
          z: clamp(spot.z + n.z * radius, -33, 33),
        };
      }
      p.target = { ...p.pos };
    }
    taker.pos = { x: spot.x - d * 0.95, z: spot.z };
    taker.angle = (d * Math.PI) / 2;
    taker.target = { ...taker.pos };
    this.resetBall(spot);
    this.protectedRestart = { kind, team, taker: taker.index };
    this.restart = {
      kind,
      team,
      spot: { ...spot },
      taker: taker.index,
      wait: 2,
    };
    this.phase = kind === "kickoff" ? "kickoff" : "setPiece";
    this.notice = labels[kind];
    if (team === this.settings.team) this.selected = taker.index;
    if (kind === "corner") this.stats[team].corners++;
    if (kind === "freeKick" || kind === "indirect" || kind === "penalty")
      this.stats[team].freeKicks++;
    audio.play("whistle");
  }
  release(p: Player, velocity: Vec3, delay: number) {
    this.owner = null;
    this.releaser = p.index;
    this.reacquireAt = this.time + delay;
    this.lockUntil = this.time + 0.1;
    this.lastTouch = p.index;
    if (this.protectedRestart && this.protectedRestart.taker !== p.index)
      this.protectedRestart = null;
    this.touchAt = this.time;
    this.body?.setLinvel(velocity, true);
    this.ballVelocity = { ...velocity };
    this.body?.setAngvel(
      { x: velocity.z / 0.22, y: 0, z: -velocity.x / 0.22 },
      true,
    );
  }
  acquire(p: Player) {
    if (this.offside.has(p.index)) {
      const spot = this.offsideSpots.get(p.index) ?? { ...p.pos };
      this.stats[p.teamId].offsides++;
      this.addEvent("rule", `${p.name} 오프사이드`, p.index);
      this.prepareRestart("indirect", (1 - p.teamId) as TeamId, spot);
      this.notice = "오프사이드 · 간접 프리킥";
      return;
    }
    if (this.pendingPass) {
      if (
        this.pendingPass.team === p.teamId &&
        this.pendingPass.from !== p.index
      ) {
        this.stats[p.teamId].completed++;
        this.assist = {
          player: this.pendingPass.from,
          team: p.teamId,
          at: this.time,
        };
      } else if (this.pendingPass.team !== p.teamId) this.assist = null;
      this.pendingPass = null;
    }
    if (this.lastOwnerTeam !== null && this.lastOwnerTeam !== p.teamId) {
      this.losingTeam = this.lastOwnerTeam;
      this.lastLoss = this.time;
      this.assist = null;
    }
    this.lastOwnerTeam = p.teamId;
    this.owner = p.index;
    this.ownedSince = this.time;
    this.lastTouch = p.index;
    if (this.protectedRestart && this.protectedRestart.taker !== p.index)
      this.protectedRestart = null;
    this.receiver = null;
    this.offside.clear();
    this.offsideSpots.clear();
    this.shot = null;
    p.animation = "ReceiveBall";
    p.actionTime = 0.2;
    this.touchAt = this.time - 0.2;
    this.protectedOwner = false;
  }
  handleAction(
    key: string,
    power: number,
    movement: Vec,
    aim: Vec,
    manual: boolean,
  ) {
    const p = this.players[this.selected];
    if (!p || p.red) return;
    if (key === "Tab") {
      this.selected = switchTarget(
        this.players,
        this.settings.team,
        this.selected,
        this.ball,
        this.ballVelocity,
        this.receiver,
      );
      return;
    }
    if (this.phase !== "playing") return;
    if (this.owner === p.index) {
      if (["Space", "KeyE", "KeyQ"].includes(key)) {
        for (const t of this.players)
          this.offsideSpots.set(t.index, { ...t.pos });
        passBall(
          this,
          p,
          key,
          power,
          Math.hypot(movement.x, movement.z) > 0.05
            ? movement
            : { x: this.dir(p.teamId), z: 0 },
        );
      } else if (["KeyF", "KeyZ", "KeyX"].includes(key))
        shootBall(this, p, key, power, aim, manual);
    } else if (
      ["KeyF", "KeyZ", "KeyX"].includes(key) &&
      this.ball.y > 1 &&
      this.ball.y < 2.7 &&
      distance(p.pos, this.ball) < 2
    ) {
      shootBall(this, p, key, power, aim, manual, this.ball.y > 1.55);
    } else if (key === "KeyR" || key === "KeyF")
      tackle(this, p, key === "KeyF");
  }
  tick(dt: number, frame: InputFrame) {
    for (const action of frame.actions) {
      if (action.key === "Escape") this.pause();
      if (action.key === "KeyC")
        this.cameraMode = ((this.cameraMode + 1) % 3) as 0 | 1 | 2;
    }
    if (["menu", "paused", "halftime", "finished"].includes(this.phase)) {
      this.publish();
      return;
    }
    this.time += dt;
    const movement = cameraRelative(frame.x, frame.y, this.forward);
    const manual = Math.hypot(frame.aimX, frame.aimY) > 0.2;
    const aim = manual
      ? cameraRelative(frame.aimX, frame.aimY, this.forward)
      : movement;
    const shootingAim =
      Math.hypot(aim.x, aim.z) > 0.05
        ? aim
        : { x: this.dir(this.settings.team), z: 0 };
    if (this.phase === "preMatch") {
      this.timer -= dt;
      if (this.timer <= 0) this.prepareRestart("kickoff", 0, { x: 0, z: 0 });
      this.publish();
      return;
    }
    if (this.phase === "goal") {
      this.timer -= dt;
      for (const p of this.players) {
        if (p.teamId === this.scoreTeam) p.animation = "Celebrate";
      }
      if (this.timer <= 0)
        this.prepareRestart("kickoff", (1 - this.scoreTeam) as TeamId, {
          x: 0,
          z: 0,
        });
      this.publish();
      return;
    }
    if (this.restart) {
      this.restart.wait -= dt;
      if (this.restart.wait < 0) {
        const r = this.restart,
          p = this.players[r.taker];
        const a = frame.actions.find((a) =>
          ["Space", "KeyE", "KeyQ", "KeyF", "KeyZ", "KeyX"].includes(a.key),
        );
        if (
          a ||
          (r.team !== this.settings.team && r.wait < -0.7) ||
          r.wait < -8
        ) {
          this.restart = null;
          this.phase = "playing";
          this.owner = p.index;
          this.ownedSince = this.time;
          this.notice = "";
          const key =
            a?.key ??
            (r.kind === "penalty"
              ? "KeyF"
              : r.kind === "corner"
                ? "KeyQ"
                : "Space");
          const restartAim =
            Math.hypot(movement.x, movement.z) > 0.05
              ? movement
              : { x: this.dir(r.team), z: 0 };
          if (
            ["KeyF", "KeyZ", "KeyX"].includes(key) &&
            r.kind !== "throwIn" &&
            r.kind !== "indirect"
          )
            shootBall(
              this,
              p,
              key,
              a?.power ?? 0.55,
              restartAim,
              !!a && Math.hypot(movement.x, movement.z) > 0.05,
            );
          else
            passBall(
              this,
              p,
              key === "KeyF" ? "Space" : key,
              a?.power ?? 0.5,
              restartAim,
            );
          if (r.kind === "throwIn") p.animation = "ThrowBall";
        }
      }
      this.publish();
      return;
    }
    if (!this.body) return;
    this.elapsed += dt;
    if (halfExpired(this.elapsed, this.settings.halfMinutes)) {
      this.elapsed = this.settings.halfMinutes * 60;
      this.phase = nextHalf(this.half);
      audio.play("whistle");
      this.publish();
      return;
    }
    this.previousBall = { ...this.ball };
    this.ball = { ...this.body.translation() };
    this.ballVelocity = { ...this.body.linvel() };
    const result = boundary(
      this.previousBall,
      this.ball,
      this.players[this.lastTouch].teamId,
      this.dir(0),
    );
    if (result) {
      if (result.kind === "goal") {
        const protectedRestart = this.protectedRestart;
        if (
          protectedRestart &&
          this.lastTouch === protectedRestart.taker &&
          (result.team !== protectedRestart.team ||
            ["throwIn", "indirect"].includes(protectedRestart.kind))
        ) {
          const directOwn = result.team !== protectedRestart.team;
          this.prepareRestart(
            directOwn ? "corner" : "goalKick",
            (1 - protectedRestart.team) as TeamId,
            {
              x: Math.sign(this.ball.x) * (directOwn ? 52 : 47),
              z: directOwn ? 33.5 : 7,
            },
          );
          this.notice = "직접 득점 불가 · 경기 재개";
        } else this.goal(result.team);
      } else {
        this.prepareRestart(result.kind, result.team, result.spot);
      }
      this.publish();
      return;
    }
    const speed = Math.hypot(
      this.ballVelocity.x,
      this.ballVelocity.y,
      this.ballVelocity.z,
    );
    if (speed > 45)
      this.body.setLinvel(
        {
          x: (this.ballVelocity.x * 45) / speed,
          y: (this.ballVelocity.y * 45) / speed,
          z: (this.ballVelocity.z * 45) / speed,
        },
        true,
      );
    if (this.ball.y < 0.3 && Math.abs(this.ballVelocity.y) < 0.5) {
      const friction = Math.max(0, 1 - dt * 1.05);
      this.body.setLinvel(
        {
          x:
            Math.abs(this.ballVelocity.x) < 0.035
              ? 0
              : this.ballVelocity.x * friction,
          y: this.ballVelocity.y,
          z:
            Math.abs(this.ballVelocity.z) < 0.035
              ? 0
              : this.ballVelocity.z * friction,
        },
        true,
      );
    }
    if (Math.abs(this.spin) > 0.05) {
      this.body.applyImpulse(
        {
          x: -this.ballVelocity.z * this.spin * 0.0008,
          y: 0,
          z: this.ballVelocity.x * this.spin * 0.0008,
        },
        true,
      );
      this.spin *= 1 - dt * 0.5;
    }
    for (const a of frame.actions)
      this.handleAction(
        a.key,
        a.power,
        movement,
        shootingAim,
        manual || Math.hypot(movement.x, movement.z) > 0.05,
      );
    if (this.phase !== "playing") {
      this.publish();
      return;
    }
    updateTeamAI({
      players: this.players,
      ball: this.ball,
      ballVelocity: this.ballVelocity,
      owner: this.owner,
      selected: this.selected,
      settings: this.settings,
      dir: (t) => this.dir(t),
      receiver: this.receiver,
      time: this.time,
      lastLoss: this.lastLoss,
      losingTeam: this.losingTeam,
    });
    this.grid.rebuild(this.players);
    this.protectedOwner = this.owner === this.selected && frame.protect;
    const controlled = this.players[this.selected];
    const enemyOwner = this.owner === null ? null : this.players[this.owner];
    const helper =
      frame.teammatePress && enemyOwner?.teamId !== this.settings.team
        ? this.players
            .filter(
              (p) =>
                p.teamId === this.settings.team &&
                !p.red &&
                p.index !== this.selected &&
                p.slot !== 0,
            )
            .sort(
              (a, b) => distance(a.pos, this.ball) - distance(b.pos, this.ball),
            )[0]
        : null;
    for (const p of this.players) {
      if (p.red) continue;
      p.actionTime = Math.max(0, p.actionTime - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.dive = Math.max(0, p.dive - dt);
      let direction = p.index === this.selected ? movement : aiDirection(p);
      let sprint =
        p.index === this.selected
          ? frame.sprint
          : ["chaseBall", "makeRun", "pressOpponent", "receivePass"].includes(
              p.ai,
            ) && p.energy > 20;
      if (
        p.index === this.selected &&
        frame.press &&
        enemyOwner?.teamId !== p.teamId &&
        enemyOwner &&
        Math.hypot(movement.x, movement.z) < 0.1
      )
        direction = normalize(
          enemyOwner.pos.x - p.pos.x,
          enemyOwner.pos.z - p.pos.z,
        );
      if (helper?.index === p.index) {
        direction = normalize(this.ball.x - p.pos.x, this.ball.z - p.pos.z);
        sprint = p.energy > 20;
      }
      if (p.index === this.owner && p.index !== this.selected) {
        direction = normalize(this.dir(p.teamId) * 25, -p.pos.z * 0.2);
        if (p.cooldown <= 0 && this.time - this.ownedSince > 0.6) {
          const shot = shotScore(p, this.players, this.dir(p.teamId));
          const pressure = this.grid
            .near(p.pos)
            .some((o) => o.teamId !== p.teamId && distance(o.pos, p.pos) < 4);
          if (shot > 29) {
            shootBall(
              this,
              p,
              "KeyF",
              0.5 + this.random() * 0.3,
              { x: this.dir(p.teamId), z: 0 },
              false,
            );
            p.cooldown = 1;
          } else if (
            pressure ||
            this.random() <
              dt *
                (p.slot === 0
                  ? 4
                  : 1.8 -
                    tactics[
                      p.teamId === this.settings.team
                        ? this.settings.tactic
                        : "balanced"
                    ].passingRisk)
          ) {
            const target = this.players
              .filter(
                (o) => o.teamId === p.teamId && o.index !== p.index && !o.red,
              )
              .sort(
                (a, b) =>
                  passScore(
                    p,
                    b,
                    { x: this.dir(p.teamId), z: 0 },
                    this.players,
                    this.dir(p.teamId),
                  ) -
                  passScore(
                    p,
                    a,
                    { x: this.dir(p.teamId), z: 0 },
                    this.players,
                    this.dir(p.teamId),
                  ),
              )[0];
            if (target) {
              for (const t of this.players)
                this.offsideSpots.set(t.index, { ...t.pos });
              passBall(
                this,
                p,
                Math.abs(p.pos.z) > 22 && p.pos.x * this.dir(p.teamId) > 28
                  ? "KeyQ"
                  : "Space",
                0.45,
                normalize(target.pos.x - p.pos.x, target.pos.z - p.pos.z),
              );
              p.cooldown = 0.8;
            }
          }
        }
      }
      if (p.animation === "SlideTackle" && p.actionTime > 0) {
        direction = { x: Math.sin(p.angle), z: Math.cos(p.angle) };
        sprint = false;
      }
      movePlayer(
        p,
        direction,
        sprint,
        p.index === this.owner,
        dt,
        p.index === this.selected && frame.protect,
      );
      for (const other of this.grid.near(p.pos)) {
        if (other.index === p.index || other.red) continue;
        const d = distance(p.pos, other.pos);
        if (d < 0.83 && d > 0.001) {
          const overlap = (0.83 - d) * 0.35;
          const resistance =
            other.stats.strength / (p.stats.strength + other.stats.strength);
          p.pos.x += ((p.pos.x - other.pos.x) / d) * overlap * resistance;
          p.pos.z += ((p.pos.z - other.pos.z) / d) * overlap * resistance;
        }
      }
      if (
        p.index !== this.selected &&
        enemyOwner &&
        enemyOwner.teamId !== p.teamId &&
        distance(p.pos, enemyOwner.pos) < 1.6 &&
        p.cooldown <= 0 &&
        this.random() < dt * 0.8 * difficulty[this.settings.difficulty].pressure
      )
        tackle(this, p, false);
    }
    if (this.phase !== "playing") {
      this.publish();
      return;
    }
    if (controlled.red)
      this.selected = switchTarget(
        this.players,
        this.settings.team,
        this.selected,
        this.ball,
        this.ballVelocity,
        this.receiver,
      );
    this.handlePossession(dt);
    this.publish();
  }
  scoreTeam: TeamId = 0;
  protectedRestart: { kind: RestartKind; team: TeamId; taker: number } | null =
    null;
  goal(team: TeamId) {
    if (this.phase !== "playing") return;
    this.score[team]++;
    if (this.shot?.team === team && !this.shot.onTarget)
      this.stats[team].onTarget++;
    this.scoreTeam = team;
    this.phase = "goal";
    this.timer = 3.5;
    const scorer = this.players[this.lastTouch];
    if (scorer.teamId === team) {
      scorer.goals++;
      if (
        this.assist &&
        this.assist.team === team &&
        this.assist.player !== scorer.index &&
        this.time - this.assist.at < 12
      )
        this.players[this.assist.player].assists++;
    }
    this.addEvent(
      "goal",
      `${scorer.name}${scorer.teamId !== team ? " (자책골)" : ""}`,
      scorer.index,
    );
    this.notice = `GOAL!  ${scorer.name}`;
    this.owner = null;
    this.shot = null;
    this.assist = null;
    audio.play("goal");
  }
  handlePossession(dt: number) {
    if (!this.body) return;
    let p = this.owner === null ? null : this.players[this.owner];
    if (p) {
      if (distance(p.pos, this.ball) > 3.1 || this.ball.y > 1.1) {
        this.owner = null;
        p = null;
      } else {
        this.stats[p.teamId].possession += dt;
        const speed = Math.hypot(p.vel.x, p.vel.z);
        const ahead = 0.72 + speed * 0.065 + (this.protectedOwner ? -0.18 : 0);
        const target = {
          x: p.pos.x + Math.sin(p.angle) * ahead,
          z: p.pos.z + Math.cos(p.angle) * ahead,
        };
        if (this.time - this.touchAt > 0.12) {
          const control = 0.78 + p.stats.dribbling * 0.002;
          this.body.setLinvel(
            {
              x: p.vel.x + (target.x - this.ball.x) * 7 * control,
              y: this.ballVelocity.y,
              z: p.vel.z + (target.z - this.ball.z) * 7 * control,
            },
            true,
          );
          this.touchAt = this.time;
        }
        return;
      }
    }
    if (this.time < this.lockUntil) return;
    const candidates = this.players
      .filter(
        (t) => !t.red && distance(t.pos, this.ball) < (t.slot === 0 ? 2 : 1.15),
      )
      .sort((a, b) => distance(a.pos, this.ball) - distance(b.pos, this.ball));
    for (const t of candidates) {
      if (t.index === this.releaser && this.time < this.reacquireAt) continue;
      if (this.offside.has(t.index) && this.ball.y < 2.7) {
        this.acquire(t);
        return;
      }
      const speed = Math.hypot(this.ballVelocity.x, this.ballVelocity.z);
      if (
        t.slot === 0 &&
        this.ball.x * this.dir(t.teamId) < -36 &&
        Math.abs(this.ball.z) < 20.16 &&
        this.ball.y < 2.6
      ) {
        const reaction =
          difficulty[this.settings.difficulty].keeperReaction *
          (1.2 - (t.stats.goalkeeping ?? 70) * 0.003);
        if (this.time - this.touchAt < reaction) continue;
        const backpass = this.pendingPass?.team === t.teamId;
        if (this.shot && t.cooldown > 0) continue;
        if (
          this.shot &&
          this.random() >
            0.5 + (t.stats.goalkeeping ?? 70) * 0.004 - speed * 0.004
        ) {
          t.cooldown = 0.45;
          t.dive = 0.4;
          t.animation =
            this.ball.z > t.pos.z
              ? "GoalkeeperDiveRight"
              : "GoalkeeperDiveLeft";
          t.actionTime = 0.4;
          continue;
        }
        if (this.shot && this.shot.team !== t.teamId) {
          this.stats[t.teamId].saves++;
          this.shot = null;
        }
        t.dive = 0.55;
        t.animation =
          this.ball.z > t.pos.z ? "GoalkeeperDiveRight" : "GoalkeeperDiveLeft";
        t.actionTime = 0.55;
        if (speed > 19 && !backpass) {
          this.lastTouch = t.index;
          this.body.setLinvel(
            {
              x: this.dir(t.teamId) * (5 + this.random() * 7),
              y: 3,
              z: (this.ball.z > 0 ? 1 : -1) * 10,
            },
            true,
          );
          this.lockUntil = this.time + 0.55;
          t.animation = "GoalkeeperPunch";
          return;
        }
        if (!backpass) {
          this.acquire(t);
          this.resetBall({ x: t.pos.x + this.dir(t.teamId) * 0.8, z: t.pos.z });
          t.animation = "GoalkeeperCatch";
          t.actionTime = 0.55;
          t.cooldown = 0.8;
          return;
        }
      }
      if (this.ball.y < 0.9) {
        if (speed > 19) {
          this.lastTouch = t.index;
          this.body.setLinvel(
            {
              x: this.ballVelocity.x * 0.42 + t.vel.x * 0.3,
              y: 1,
              z: this.ballVelocity.z * 0.42 + t.vel.z * 0.3,
            },
            true,
          );
          this.lockUntil = this.time + 0.16;
          return;
        }
        if (speed < 10 + t.stats.control * 0.13) {
          this.acquire(t);
          return;
        }
      }
    }
  }
  publish() {
    if (this.time < this.uiAt && this.phase === "playing") return;
    this.uiAt = this.time + 0.1;
    const p = this.players[this.selected];
    useMatch.setState({
      phase: this.phase,
      half: this.half,
      elapsed: this.elapsed,
      score: [...this.score],
      selected: this.selected,
      energy: p?.energy ?? 0,
      owner: this.owner,
      notice: this.notice,
      power: input.power,
      stats: [{ ...this.stats[0] }, { ...this.stats[1] }],
      events: [...this.events],
      fps: this.fps,
    });
  }
}
export const match = new MatchEngine();
