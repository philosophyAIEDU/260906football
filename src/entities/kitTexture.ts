import * as THREE from "three";
import { regions } from "./playerBody";
import { teams } from "../data/teams";
import { assetConfig } from "../data/assets";
import type { Player } from "../game/types";
const SIZE = 512;
/** Optional shirt artwork from public/assets, painted over the torso panel. */
const overlays: (HTMLImageElement | null)[] = [null, null];
let overlayLoad: Promise<void> | null = null;
export function loadKitOverlays(): Promise<void> {
  return (overlayLoad ??= Promise.all(
    assetConfig.uniformTextures.map(
      (url, i) =>
        new Promise<void>((resolve) => {
          if (!url) return resolve();
          const image = new Image();
          image.onload = () => {
            overlays[i] = image;
            resolve();
          };
          image.onerror = () => resolve();
          image.src = url;
        }),
    ),
  ).then(() => undefined));
}
/** Deterministic per-player variation so a squad is not eleven clones. */
function variant(index: number) {
  const skins = ["#e0b48f", "#c68d64", "#8d5a3b", "#5f3a26", "#f0c6a2"];
  const hairs = ["#1d1712", "#2f2118", "#0f1113", "#4a3221", "#6d5334"];
  const boots = ["#f2e14a", "#f4f6f2", "#ff6a3d", "#16d0c0", "#1b1d21"];
  const seed = (index * 2654435761) >>> 0;
  return {
    skin: skins[seed % skins.length],
    hair: hairs[(seed >>> 4) % hairs.length],
    boot: boots[(seed >>> 8) % boots.length],
    /** Height multiplier, roughly 1.74 m to 1.90 m. */
    height: 0.965 + (((seed >>> 12) % 100) / 100) * 0.075,
    build: 0.95 + (((seed >>> 18) % 100) / 100) * 0.12,
  };
}
export type Variant = ReturnType<typeof variant>;
const shade = (hex: string, amount: number) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0.03, 0.97));
  return `#${c.getHexString()}`;
};
const readable = (hex: string) => {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.55 ? "#12181d" : "#ffffff";
};
type Rect = { x: number; y: number; w: number; h: number };
const rect = (r: (typeof regions)[keyof typeof regions]): Rect => ({
  x: r.u0 * SIZE,
  y: (1 - r.v1) * SIZE,
  w: (r.u1 - r.u0) * SIZE,
  h: (r.v1 - r.v0) * SIZE,
});
/** Region-local coordinates: `t` runs around the ring, `v` along the part. */
const at = (r: Rect, t: number, v: number): [number, number] => [
  r.x + t * r.w,
  r.y + (1 - v) * r.h,
];
function noise(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  amount: number,
  seed: number,
) {
  let s = seed || 1;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  for (let i = 0; i < r.w * r.h * 0.12; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * amount})`;
    ctx.fillRect(r.x + random() * r.w, r.y + random() * r.h, 1.6, 1.6);
  }
  ctx.restore();
}
export function createKitTexture(player: Player): {
  texture: THREE.CanvasTexture;
  variant: Variant;
} {
  const look = variant(player.index);
  const team = teams[player.teamId];
  const keeper = player.slot === 0;
  const kit = keeper ? team.keeper : team.kit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = look.skin;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const ink = readable(kit.shirt);
  // ---- shirt and shorts -----------------------------------------------
  const torso = rect(regions.torso);
  ctx.fillStyle = kit.shirt;
  ctx.fillRect(torso.x, torso.y, torso.w, torso.h);
  const artwork = overlays[player.teamId];
  const hem = 0.175; // shorts waist, in torso-local v
  if (artwork) ctx.drawImage(artwork, torso.x, torso.y, torso.w, torso.h);
  else if (kit.pattern === "stripe")
    for (let i = 0; i < 12; i++) {
      if (i % 2) continue;
      const [x, y] = at(torso, i / 12, 1);
      ctx.fillStyle = kit.alt;
      ctx.fillRect(x, y, torso.w / 12, torso.h * (1 - hem));
    }
  else {
    ctx.fillStyle = kit.alt;
    const [, y] = at(torso, 0, 0.72);
    ctx.fillRect(torso.x, y, torso.w, torso.h * 0.15);
    ctx.fillStyle = shade(kit.alt, -0.08);
    ctx.fillRect(torso.x, y + torso.h * 0.15, torso.w, torso.h * 0.02);
  }
  ctx.fillStyle = kit.shorts;
  ctx.fillRect(torso.x, at(torso, 0, hem)[1], torso.w, torso.h * hem);
  ctx.fillStyle = shade(kit.shorts, 0.16);
  ctx.fillRect(torso.x, at(torso, 0, hem)[1], torso.w, 4);
  ctx.fillStyle = kit.trim; // collar
  ctx.fillRect(torso.x, at(torso, 0, 0.985)[1], torso.w, torso.h * 0.035);
  noise(ctx, torso, 0.09, 91 + player.index);
  // Squad number and name, back at t=0.25 and chest at t=0.75.
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "800 74px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(String(player.shirtNumber), ...at(torso, 0.25, 0.53));
  ctx.font = "700 20px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(
    player.name.toUpperCase().slice(0, 12),
    ...at(torso, 0.25, 0.79),
  );
  ctx.font = "800 26px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(String(player.shirtNumber), ...at(torso, 0.68, 0.72));
  ctx.font = "700 15px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(team.short, ...at(torso, 0.75, 0.53));
  ctx.fillStyle = kit.trim; // crest
  const [cx, cy] = at(torso, 0.82, 0.72);
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 11);
  ctx.lineTo(cx + 8, cy - 11);
  ctx.lineTo(cx + 8, cy + 3);
  ctx.lineTo(cx, cy + 12);
  ctx.lineTo(cx - 8, cy + 3);
  ctx.closePath();
  ctx.fill();
  // ---- sleeves, forearms, hands ---------------------------------------
  const arm = rect(regions.arm);
  ctx.fillStyle = look.skin;
  ctx.fillRect(arm.x, arm.y, arm.w, arm.h);
  const sleeve = keeper ? 0.77 : 0.27;
  ctx.fillStyle = kit.sleeve;
  ctx.fillRect(arm.x, at(arm, 0, sleeve)[1], arm.w, arm.h * sleeve);
  ctx.fillStyle = kit.trim;
  ctx.fillRect(arm.x, at(arm, 0, sleeve)[1], arm.w, 5);
  if (keeper) {
    ctx.fillStyle = kit.gloves;
    ctx.fillRect(arm.x, arm.y, arm.w, arm.h * 0.23);
    ctx.fillStyle = shade(kit.gloves, -0.22);
    ctx.fillRect(arm.x, arm.y + arm.h * 0.06, arm.w, 4);
  }
  noise(ctx, arm, 0.07, 613 + player.index);
  // ---- shorts leg, thigh, socks ---------------------------------------
  const leg = rect(regions.leg);
  ctx.fillStyle = look.skin;
  ctx.fillRect(leg.x, leg.y, leg.w, leg.h);
  // The strip runs hip (v = 0) to ankle (v = 1).
  ctx.fillStyle = kit.shorts;
  ctx.fillRect(leg.x, at(leg, 0, 0.28)[1], leg.w, leg.h * 0.28);
  ctx.fillStyle = shade(kit.shorts, -0.12);
  ctx.fillRect(leg.x, at(leg, 0, 0.28)[1], leg.w, 5);
  ctx.fillStyle = kit.socks;
  ctx.fillRect(leg.x, at(leg, 0, 1)[1], leg.w, leg.h * 0.4);
  ctx.fillStyle = kit.trim;
  ctx.fillRect(leg.x, at(leg, 0, 0.62)[1], leg.w, 7);
  ctx.fillStyle = shade(kit.socks, -0.16);
  ctx.fillRect(leg.x, at(leg, 0, 1)[1], leg.w, leg.h * 0.05);
  noise(ctx, leg, 0.08, 227 + player.index);
  // ---- face ------------------------------------------------------------
  const head = rect(regions.head);
  ctx.fillStyle = look.skin;
  ctx.fillRect(head.x, head.y, head.w, head.h);
  ctx.fillStyle = shade(look.skin, -0.09);
  ctx.fillRect(head.x, at(head, 0, 0.16)[1], head.w, head.h * 0.16);
  const face = (t: number, v: number) => at(head, t, v);
  ctx.fillStyle = shade(look.hair, 0.02);
  ctx.fillRect(head.x, at(head, 0, 0.72)[1], head.w, head.h * 0.28);
  ctx.beginPath(); // hairline dipping over the brow
  ctx.ellipse(...face(0.75, 0.72), head.w * 0.13, head.h * 0.05, 0, 0, Math.PI);
  ctx.fill();
  for (const t of [0.72, 0.78]) {
    ctx.fillStyle = "#f6f3ee";
    ctx.beginPath();
    ctx.ellipse(...face(t, 0.545), 5.2, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2118";
    ctx.beginPath();
    ctx.arc(...face(t, 0.545), 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(look.hair, -0.02);
    ctx.fillRect(...at(head, t - 0.028, 0.6), 10, 3.4);
  }
  ctx.fillStyle = shade(look.skin, -0.13);
  ctx.beginPath();
  ctx.ellipse(...face(0.75, 0.44), 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(look.skin, -0.26);
  ctx.beginPath();
  ctx.ellipse(...face(0.75, 0.325), 7, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  noise(ctx, head, 0.05, 401 + player.index);
  // ---- hair and boots --------------------------------------------------
  const hair = rect(regions.hair);
  ctx.fillStyle = look.hair;
  ctx.fillRect(hair.x, hair.y, hair.w, hair.h);
  noise(ctx, hair, 0.18, 733 + player.index);
  const boot = rect(regions.boot);
  ctx.fillStyle = look.boot;
  ctx.fillRect(boot.x, boot.y, boot.w, boot.h);
  ctx.fillStyle = "#15181c";
  ctx.fillRect(boot.x + boot.w * 0.38, boot.y, boot.w * 0.24, boot.h);
  ctx.fillStyle = readable(look.boot);
  ctx.globalAlpha = 0.75;
  ctx.fillRect(boot.x + boot.w * 0.08, boot.y + boot.h * 0.42, boot.w * 0.2, 4);
  ctx.globalAlpha = 1;
  noise(ctx, boot, 0.07, 877 + player.index);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, variant: look };
}
