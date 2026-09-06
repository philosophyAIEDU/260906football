export type TeamId = 0 | 1;
export type MatchPhase =
  | "menu"
  | "preMatch"
  | "kickoff"
  | "playing"
  | "stopped"
  | "setPiece"
  | "goal"
  | "halftime"
  | "finished"
  | "paused";
export type PlayerPosition =
  | "GK"
  | "LB"
  | "LCB"
  | "RCB"
  | "RB"
  | "CDM"
  | "LCM"
  | "RCM"
  | "LW"
  | "ST"
  | "RW";
export type Formation = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2" | "5-3-2";
export type Tactic =
  | "balanced"
  | "attacking"
  | "defensive"
  | "pressing"
  | "possession"
  | "counter";
export type AIState =
  | "holdPosition"
  | "supportAttack"
  | "makeRun"
  | "chaseBall"
  | "pressOpponent"
  | "markOpponent"
  | "coverSpace"
  | "receivePass"
  | "pass"
  | "cross"
  | "shoot"
  | "tackle"
  | "returnToFormation";
export type Animation =
  | "Idle"
  | "Walk"
  | "Jog"
  | "Run"
  | "Sprint"
  | "Pass"
  | "ThroughPass"
  | "Cross"
  | "Shoot"
  | "CurledShot"
  | "Tackle"
  | "SlideTackle"
  | "ReceiveBall"
  | "Header"
  | "Fall"
  | "GetUp"
  | "Celebrate"
  | "GoalkeeperIdle"
  | "GoalkeeperMove"
  | "GoalkeeperDiveLeft"
  | "GoalkeeperDiveRight"
  | "GoalkeeperCatch"
  | "GoalkeeperPunch"
  | "GoalkeeperKick"
  | "ThrowBall"
  | "Backpedal"
  | "TurnLeft"
  | "TurnRight";
export interface Vec {
  x: number;
  z: number;
}
export interface Vec3 extends Vec {
  y: number;
}
export interface PlayerStats {
  speed: number;
  acceleration: number;
  stamina: number;
  strength: number;
  agility: number;
  balance: number;
  passing: number;
  crossing: number;
  shooting: number;
  finishing: number;
  control: number;
  dribbling: number;
  heading: number;
  tackling: number;
  positioning: number;
  goalkeeping?: number;
}
export interface PlayerIdentity {
  id: string;
  teamId: TeamId;
  name: string;
  shirtNumber: number;
  position: PlayerPosition;
}
export interface Player extends PlayerIdentity {
  index: number;
  slot: number;
  pos: Vec;
  vel: Vec;
  target: Vec;
  angle: number;
  energy: number;
  stats: PlayerStats;
  ai: AIState;
  animation: Animation;
  actionTime: number;
  cooldown: number;
  thinkAt: number;
  yellow: number;
  red: boolean;
  goals: number;
  assists: number;
  dive: number;
}
export interface TeamTactics {
  defensiveLine: number;
  teamWidth: number;
  compactness: number;
  pressingIntensity: number;
  attackingSupport: number;
  passingRisk: number;
  transitionSpeed: number;
  fullbackOverlap: number;
}
export interface Settings {
  team: TeamId;
  difficulty: "easy" | "normal" | "hard";
  halfMinutes: number;
  formation: Formation;
  tactic: Tactic;
  offside: boolean;
  passAssist: "high" | "medium" | "low";
  quality: "low" | "medium" | "high";
  volume: number;
  crowdVolume: number;
  effectsVolume: number;
  muted: boolean;
  camera: 0 | 1 | 2;
  shake: boolean;
}
export interface TeamStats {
  possession: number;
  shots: number;
  onTarget: number;
  passes: number;
  completed: number;
  tackles: number;
  tacklesWon: number;
  corners: number;
  freeKicks: number;
  fouls: number;
  offsides: number;
  yellows: number;
  reds: number;
  saves: number;
}
export type RestartKind =
  | "kickoff"
  | "throwIn"
  | "goalKick"
  | "corner"
  | "freeKick"
  | "indirect"
  | "penalty";
export interface Restart {
  kind: RestartKind;
  team: TeamId;
  spot: Vec;
  taker: number;
  wait: number;
}
export interface MatchEvent {
  minute: number;
  kind: "goal" | "card" | "rule";
  text: string;
  player?: number;
  team?: TeamId;
}
export interface BallBody {
  translation(): Vec3;
  linvel(): Vec3;
  setTranslation(v: Vec3, wake: boolean): void;
  setLinvel(v: Vec3, wake: boolean): void;
  setAngvel(v: Vec3, wake: boolean): void;
  applyImpulse(v: Vec3, wake: boolean): void;
}
export interface Action {
  key: string;
  power: number;
}
export interface InputFrame {
  x: number;
  y: number;
  sprint: boolean;
  protect: boolean;
  press: boolean;
  teammatePress: boolean;
  aimX: number;
  aimY: number;
  actions: Action[];
}
