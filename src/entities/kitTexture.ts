import * as THREE from "three";
import { regions, FRONT, BACK } from "./playerBody";
import { teams } from "../data/teams";
import { assetConfig } from "../data/assets";
import type { Player } from "../game/types";
const SIZE = 640;
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
  const skins = ["#e2b891", "#c98f65", "#9a6440", "#6b442c", "#f1c9a6"];
  const hairs = ["#1d1712", "#2f2118", "#0f1113", "#4a3221", "#6d5334"];
  const boots = ["#f2e14a", "#f4f6f2", "#ff6a3d", "#16d0c0", "#1b1d21"];
  const seed = (index * 2654435761) >>> 0;
  const spread = (shift: number, low: number, high: number) =>
    low + (((seed >>> shift) % 100) / 100) * (high - low);
  return {
    skin: skins[seed % skins.length],
    hair: hairs[(seed >>> 4) % hairs.length],
    boot: boots[(seed >>> 8) % boots.length],
    brow: spread(2, 0.7, 1.35),
    nose: spread(6, 0.88, 1.18),
    lips: spread(10, 0.82, 1.2),
    jawShadow: spread(14, 0, 1) > 0.55 ? 0.3 : 0,
    hairline: spread(16, 0.79, 0.87),
    eyeGap: spread(20, 0.048, 0.062),
    /** Head size and squash, applied to the head bone. */
    headScale: [spread(22, 0.95, 1.04), spread(24, 0.96, 1.05)] as [
      number,
      number,
    ],
    /** Height multiplier, roughly 1.74 m to 1.88 m against a 1.80 m base. */
    height: 0.967 + (((seed >>> 12) % 100) / 100) * 0.077,
    build: 0.95 + (((seed >>> 18) % 100) / 100) * 0.12,
  };
}
export type Variant = ReturnType<typeof variant>;
/** Where each material band sits along its part, in part-local v. */
const bands = {
  shortsWaist: 0.256,
  neckline: 0.909,
  sleeve: 0.27,
  keeperSleeve: 0.77,
  glove: 0.23,
  shortsLeg: 0.28,
  sockTop: 0.62,
};
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
function surface(width: number, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}
function seeded(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/** Soft elliptical stain, repeated so it survives the seam at t = 0. */
function blot(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  t: number,
  v: number,
  rt: number,
  rv: number,
  colour: string,
  alpha: number,
) {
  for (const offset of [-1, 0, 1]) {
    const [x, y] = at(r, t + offset, v);
    const rx = rt * r.w,
      ry = rv * r.h;
    if (x + rx < r.x || x - rx > r.x + r.w) continue;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, "transparent");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
function grain(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  amount: number,
  seed: number,
) {
  const random = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  for (let i = 0; i < r.w * r.h * 0.1; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * amount})`;
    ctx.fillRect(r.x + random() * r.w, r.y + random() * r.h, 1.6, 1.6);
  }
  ctx.restore();
}
// ---------------------------------------------------------------------------
// Colour atlas
// ---------------------------------------------------------------------------
export function createKitTexture(player: Player): {
  texture: THREE.CanvasTexture;
  variant: Variant;
} {
  const look = variant(player.index);
  const team = teams[player.teamId];
  const keeper = player.slot === 0;
  const kit = keeper ? team.keeper : team.kit;
  const { canvas, ctx } = surface(SIZE);
  ctx.fillStyle = look.skin;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const ink = readable(kit.shirt);
  const dark = "rgba(4,10,16,0.55)";
  // ---- shirt and shorts -----------------------------------------------
  const torso = rect(regions.torso);
  ctx.fillStyle = kit.shirt;
  ctx.fillRect(torso.x, torso.y, torso.w, torso.h);
  const artwork = overlays[player.teamId];
  const hem = bands.shortsWaist;
  if (artwork) ctx.drawImage(artwork, torso.x, torso.y, torso.w, torso.h);
  else if (kit.pattern === "stripe")
    for (let i = 0; i < 12; i++) {
      if (i % 2) continue;
      const [x, y] = at(torso, i / 12, bands.neckline);
      ctx.fillStyle = kit.alt;
      ctx.fillRect(x, y, torso.w / 12, torso.h * (bands.neckline - hem));
    }
  else {
    ctx.fillStyle = kit.alt;
    const [, y] = at(torso, 0, 0.79);
    ctx.fillRect(torso.x, y, torso.w, torso.h * 0.14);
    ctx.fillStyle = shade(kit.alt, -0.08);
    ctx.fillRect(torso.x, y + torso.h * 0.14, torso.w, torso.h * 0.018);
  }
  ctx.fillStyle = kit.shorts;
  ctx.fillRect(torso.x, at(torso, 0, hem)[1], torso.w, torso.h * hem);
  ctx.fillStyle = shade(kit.shorts, 0.16);
  ctx.fillRect(torso.x, at(torso, 0, hem)[1], torso.w, 4);
  ctx.fillStyle = look.skin; // neck
  ctx.fillRect(torso.x, torso.y, torso.w, torso.h * (1 - bands.neckline));
  ctx.fillStyle = kit.trim; // collar
  ctx.fillRect(torso.x, at(torso, 0, bands.neckline)[1], torso.w, torso.h * 0.028);
  grain(ctx, torso, 0.08, 91 + player.index);
  // Squad number and name across the spine, club marks on the chest.
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "800 66px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(String(player.shirtNumber), ...at(torso, BACK, 0.66));
  ctx.font = "700 17px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(player.name.toUpperCase().slice(0, 11), ...at(torso, BACK, 0.795));
  ctx.font = "800 25px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(String(player.shirtNumber), ...at(torso, FRONT - 0.1, 0.735));
  ctx.font = "700 14px Barlow Condensed, Arial Narrow, Arial";
  ctx.fillText(team.city, ...at(torso, FRONT, 0.6));
  ctx.fillStyle = kit.trim; // crest
  const [cx, cy] = at(torso, FRONT + 0.1, 0.735);
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 11);
  ctx.lineTo(cx + 8, cy - 11);
  ctx.lineTo(cx + 8, cy + 3);
  ctx.lineTo(cx, cy + 12);
  ctx.lineTo(cx - 8, cy + 3);
  ctx.closePath();
  ctx.fill();
  // Contact shading: armpits, the hollow under the collar, the shorts hem.
  for (const flank of [0, 0.5]) blot(ctx, torso, flank, 0.845, 0.07, 0.055, dark, 0.5);
  blot(ctx, torso, FRONT, 0.9, 0.13, 0.025, dark, 0.4);
  blot(ctx, torso, BACK, 0.895, 0.15, 0.03, dark, 0.34);
  blot(ctx, torso, FRONT, 0.012, 0.055, 0.03, dark, 0.62); // split between the legs
  blot(ctx, torso, BACK, 0.012, 0.055, 0.03, dark, 0.62);
  // ---- sleeves, forearms, hands ---------------------------------------
  const arm = rect(regions.arm);
  ctx.fillStyle = look.skin;
  ctx.fillRect(arm.x, arm.y, arm.w, arm.h);
  const sleeve = keeper ? bands.keeperSleeve : bands.sleeve;
  ctx.fillStyle = kit.sleeve;
  ctx.fillRect(arm.x, at(arm, 0, sleeve)[1], arm.w, arm.h * sleeve);
  ctx.fillStyle = kit.trim;
  ctx.fillRect(arm.x, at(arm, 0, sleeve)[1], arm.w, 5);
  if (keeper) {
    ctx.fillStyle = kit.gloves;
    ctx.fillRect(arm.x, arm.y, arm.w, arm.h * bands.glove);
    ctx.fillStyle = shade(kit.gloves, -0.22);
    ctx.fillRect(arm.x, arm.y + arm.h * 0.06, arm.w, 4);
  }
  blot(ctx, arm, 0, 0.04, 0.16, 0.06, dark, 0.45); // inner arm against the ribs
  blot(ctx, arm, 0, 0.02, 0.5, 0.02, dark, 0.3); // shoulder root
  blot(ctx, arm, FRONT, 0.44, 0.16, 0.03, dark, 0.28); // inner elbow
  grain(ctx, arm, 0.06, 613 + player.index);
  // ---- thigh, knee, socks ---------------------------------------------
  const leg = rect(regions.leg);
  ctx.fillStyle = look.skin;
  ctx.fillRect(leg.x, leg.y, leg.w, leg.h);
  ctx.fillStyle = kit.shorts;
  ctx.fillRect(leg.x, at(leg, 0, bands.shortsLeg)[1], leg.w, leg.h * bands.shortsLeg);
  ctx.fillStyle = shade(kit.shorts, -0.12);
  ctx.fillRect(leg.x, at(leg, 0, bands.shortsLeg)[1], leg.w, 5);
  ctx.fillStyle = kit.socks;
  ctx.fillRect(leg.x, at(leg, 0, 1)[1], leg.w, leg.h * (1 - bands.sockTop));
  ctx.fillStyle = kit.trim;
  ctx.fillRect(leg.x, at(leg, 0, bands.sockTop)[1], leg.w, 7);
  ctx.fillStyle = shade(kit.socks, -0.16);
  ctx.fillRect(leg.x, at(leg, 0, 1)[1], leg.w, leg.h * 0.05);
  blot(ctx, leg, 0, 0.06, 0.16, 0.08, dark, 0.55); // inner thigh, in shadow
  blot(ctx, leg, 0, 0.22, 0.13, 0.09, dark, 0.4);
  blot(ctx, leg, 0, 0.4, 0.1, 0.08, dark, 0.26);
  blot(ctx, leg, BACK, 0.52, 0.2, 0.04, dark, 0.28); // back of the knee
  blot(ctx, leg, 0.5, 0.3, 0.1, 0.16, "rgba(255,246,232,0.5)", 0.16); // outer light
  grain(ctx, leg, 0.07, 227 + player.index);
  // ---- face --------------------------------------------------------------
  // Features are laid out in metres and converted, because the head panel is
  // roughly twice as resolved along the skull as it is around it.
  const head = rect(regions.head);
  const around = head.w / 0.575; // pixels per metre around the skull
  const along = head.h / 0.336; // pixels per metre up the skull
  const level = (y: number) => (y - 1.47) / 0.336;
  const wide = (metres: number) => (metres * around) / 2;
  const tall = (metres: number) => (metres * along) / 2;
  const turn = (metres: number) => metres / 0.575;
  ctx.fillStyle = look.skin;
  ctx.fillRect(head.x, head.y, head.w, head.h);
  blot(ctx, head, FRONT, level(1.5), 0.3, 0.08, dark, 0.55); // under the jaw
  blot(ctx, head, BACK, 0.9, 0.4, 0.12, "rgba(20,14,10,0.6)", 0.3);
  for (const side of [-1, 1]) {
    // Temple and cheek hollow.
    blot(
      ctx,
      head,
      FRONT + side * 0.088,
      level(1.62),
      0.05,
      0.055,
      "rgba(60,32,18,0.5)",
      0.3,
    );
    // Ear, painted where the skull carries its small lateral bulge.
    const ear = 0.25 + side * 0.25;
    blot(ctx, head, ear, level(1.66), 0.028, 0.05, "rgba(58,30,16,0.45)", 0.55);
    ctx.fillStyle = shade(look.skin, 0.05);
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, ear, level(1.662)),
      wide(0.022),
      tall(0.032),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = shade(look.skin, -0.16);
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, ear, level(1.658)),
      wide(0.011),
      tall(0.018),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  if (look.jawShadow) {
    // Stubble across the jaw and top lip.
    ctx.save();
    ctx.globalAlpha = look.jawShadow;
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, FRONT, level(1.592)),
      wide(0.115),
      tall(0.055),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = shade(look.hair, 0.02); // scalp, dipping at the peak
  ctx.fillRect(head.x, at(head, 0, 1)[1], head.w, head.h * (1 - look.hairline));
  ctx.beginPath();
  ctx.ellipse(
    ...at(head, FRONT, look.hairline),
    head.w * 0.115,
    head.h * 0.035,
    0,
    0,
    Math.PI,
  );
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.75;
  for (const side of [-1, 1]) {
    const [x, y] = at(head, FRONT + side * 0.098, look.hairline);
    ctx.fillRect(x - wide(0.008), y, wide(0.016), tall(0.032));
  }
  ctx.restore();
  blot(ctx, head, FRONT, look.hairline - 0.012, 0.14, 0.016, "rgba(0,0,0,0.5)", 0.22);
  for (const side of [-1, 1]) {
    const t = FRONT + side * turn(look.eyeGap);
    ctx.fillStyle = "rgba(38,24,15,0.3)"; // socket
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t, level(1.7)),
      wide(0.036),
      tall(0.024),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#eee8dc"; // sclera
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t, level(1.699)),
      wide(0.028),
      tall(0.0115),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#493322"; // iris
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t, level(1.699)),
      wide(0.0125),
      tall(0.0115),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#150f09";
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t, level(1.699)),
      wide(0.006),
      tall(0.0055),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)"; // catch light
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t - side * 0.004, level(1.7015)),
      wide(0.004),
      tall(0.0035),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "rgba(32,20,13,0.5)"; // upper lid
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t, level(1.7035)),
      wide(0.03),
      tall(0.007),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = shade(look.skin, -0.06); // lower lid
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, t, level(1.6945)),
      wide(0.028),
      tall(0.004),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // Brows read as paint if they are hard edged, so build them from a few
    // translucent passes that fade at the tail.
    for (let pass = 0; pass < 3; pass++) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = shade(look.hair, 0.03);
      ctx.beginPath();
      ctx.ellipse(
        ...at(head, t - side * pass * 0.004, level(1.7205 + pass * 0.0006)),
        wide((0.03 - pass * 0.004) * look.brow),
        tall((0.0075 - pass * 0.0012) * look.brow),
        side * 0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = shade(look.skin, -0.1); // bridge shading
  for (const side of [-1, 1]) {
    const [x, y] = at(head, FRONT + side * turn(0.014 * look.nose), level(1.69));
    ctx.fillRect(x - 1, y, 2, tall(0.05));
  }
  ctx.fillStyle = shade(look.skin, -0.13); // nose base shadow
  ctx.beginPath();
  ctx.ellipse(
    ...at(head, FRONT, level(1.6395)),
    wide(0.03 * look.nose),
    tall(0.012),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = shade(look.skin, -0.4); // nostrils
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(
      ...at(head, FRONT + side * turn(0.011 * look.nose), level(1.638)),
      wide(0.008),
      tall(0.005),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = shade(look.skin, -0.24); // upper lip
  ctx.beginPath();
  ctx.ellipse(
    ...at(head, FRONT, level(1.6095)),
    wide(0.046 * look.lips),
    tall(0.009 * look.lips),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = shade(look.skin, -0.34); // mouth line
  ctx.beginPath();
  ctx.ellipse(
    ...at(head, FRONT, level(1.606)),
    wide(0.048 * look.lips),
    tall(0.003),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = shade(look.skin, 0.04); // lower lip
  ctx.beginPath();
  ctx.ellipse(
    ...at(head, FRONT, level(1.6015)),
    wide(0.04 * look.lips),
    tall(0.008 * look.lips),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  blot(ctx, head, FRONT, level(1.588), 0.06, 0.02, "rgba(60,34,18,0.5)", 0.35);
  grain(ctx, head, 0.022, 401 + player.index);
  // ---- hair and boots --------------------------------------------------
  const hair = rect(regions.hair);
  ctx.fillStyle = look.hair;
  ctx.fillRect(hair.x, hair.y, hair.w, hair.h);
  grain(ctx, hair, 0.16, 733 + player.index);
  const boot = rect(regions.boot);
  ctx.fillStyle = look.boot;
  ctx.fillRect(boot.x, boot.y, boot.w, boot.h);
  ctx.fillStyle = "#15181c"; // sole wraps the t = 0.5 band
  ctx.fillRect(boot.x + boot.w * 0.38, boot.y, boot.w * 0.24, boot.h);
  ctx.fillStyle = readable(look.boot);
  ctx.globalAlpha = 0.75;
  ctx.fillRect(boot.x + boot.w * 0.08, boot.y + boot.h * 0.42, boot.w * 0.2, 4);
  ctx.globalAlpha = 1;
  blot(ctx, boot, 0, 0.94, 0.5, 0.04, dark, 0.4); // ankle collar
  grain(ctx, boot, 0.06, 877 + player.index);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, variant: look };
}
// ---------------------------------------------------------------------------
// Shared relief and roughness. Only the keeper's long sleeves and gloves change
// these, so two variants cover the whole squad.
// ---------------------------------------------------------------------------
const surfaces = new Map<string, { normal: THREE.Texture; roughness: THREE.Texture }>();
function paintRelief(ctx: CanvasRenderingContext2D, keeper: boolean) {
  const random = seeded(5501);
  ctx.filter = "blur(2px)";
  const fold = (
    r: Rect,
    t: number,
    v: number,
    length: number,
    lean: number,
    light: boolean,
  ) => {
    const [x, y] = at(r, t, v);
    ctx.strokeStyle = light ? "#a6a6a6" : "#5c5c5c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean * r.w, y + length * r.h);
    ctx.stroke();
  };
  const torso = rect(regions.torso);
  for (let i = 0; i < 16; i++) {
    const t = random(),
      v = 0.2 + random() * 0.6;
    fold(torso, t, v, 0.06 + random() * 0.1, (random() - 0.5) * 0.05, i % 2 === 0);
  }
  const leg = rect(regions.leg);
  for (let i = 0; i < 10; i++)
    fold(leg, random(), 0.02 + random() * 0.24, 0.05 + random() * 0.08, 0, i % 2 === 0);
  ctx.filter = "none";
  // Sock ribbing runs along the leg, so the ribs are columns in the atlas.
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 34; i++) {
    ctx.strokeStyle = i % 2 ? "#8f8f8f" : "#6f6f6f";
    const [x, y0] = at(leg, i / 34, bands.sockTop);
    const [, y1] = at(leg, 0, 1);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }
  const arm = rect(regions.arm);
  const cuff = keeper ? bands.keeperSleeve : bands.sleeve;
  ctx.strokeStyle = "#5a5a5a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(...at(arm, 0, cuff));
  ctx.lineTo(...at(arm, 1, cuff));
  ctx.stroke();
  // Boot: laces up the instep, tread across the sole, a toe box crease.
  const boot = rect(regions.boot);
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 6; i++) {
    const v = 0.32 + i * 0.09;
    ctx.strokeStyle = "#a8a8a8";
    ctx.beginPath();
    ctx.moveTo(...at(boot, 0.92, v));
    ctx.lineTo(...at(boot, 1.08, v + 0.03));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...at(boot, -0.08, v));
    ctx.lineTo(...at(boot, 0.08, v + 0.03));
    ctx.stroke();
  }
  ctx.strokeStyle = "#4f4f4f";
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const v = 0.1 + i * 0.1;
    ctx.beginPath();
    ctx.moveTo(...at(boot, 0.4, v));
    ctx.lineTo(...at(boot, 0.6, v));
    ctx.stroke();
  }
  // Hair strands.
  const hair = rect(regions.hair);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 220; i++) {
    ctx.strokeStyle = random() > 0.5 ? "#9a9a9a" : "#666666";
    const x = hair.x + random() * hair.w,
      y = hair.y + random() * hair.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 6, y + 4 + random() * 12);
    ctx.stroke();
  }
}
function buildSurfaces(keeper: boolean) {
  const height = surface(SIZE);
  height.ctx.fillStyle = "#808080";
  height.ctx.fillRect(0, 0, SIZE, SIZE);
  paintRelief(height.ctx, keeper);
  const source = height.ctx.getImageData(0, 0, SIZE, SIZE).data;
  const normalCanvas = surface(SIZE);
  const image = normalCanvas.ctx.createImageData(SIZE, SIZE);
  const sample = (x: number, y: number) =>
    source[
      (Math.min(SIZE - 1, Math.max(0, y)) * SIZE +
        Math.min(SIZE - 1, Math.max(0, x))) *
        4
    ] / 255;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = sample(x + 1, y) - sample(x - 1, y);
      const dy = sample(x, y + 1) - sample(x, y - 1);
      const i = (y * SIZE + x) * 4;
      image.data[i] = THREE.MathUtils.clamp(128 - dx * 220, 0, 255);
      image.data[i + 1] = THREE.MathUtils.clamp(128 - dy * 220, 0, 255);
      image.data[i + 2] = 240;
      image.data[i + 3] = 255;
    }
  normalCanvas.ctx.putImageData(image, 0, 0);
  const rough = surface(SIZE);
  const grey = (value: number) => `rgb(${value},${value},${value})`;
  rough.ctx.fillStyle = grey(158); // skin
  rough.ctx.fillRect(0, 0, SIZE, SIZE);
  const fill = (r: Rect, v0: number, v1: number, value: number) => {
    const y = at(r, 0, v1)[1];
    rough.ctx.fillStyle = grey(value);
    rough.ctx.fillRect(r.x, y, r.w, (v1 - v0) * r.h);
  };
  fill(rect(regions.torso), 0, 1, 236); // shirt and shorts fabric
  fill(rect(regions.leg), 0, bands.shortsLeg, 236);
  fill(rect(regions.leg), bands.sockTop, 1, 252);
  const arm = rect(regions.arm);
  fill(arm, 0, keeper ? bands.keeperSleeve : bands.sleeve, 236);
  if (keeper) fill(arm, 1 - bands.glove, 1, 205);
  fill(rect(regions.boot), 0, 1, 78); // leather
  fill(rect(regions.hair), 0, 1, 190);
  return {
    normal: new THREE.CanvasTexture(normalCanvas.canvas),
    roughness: new THREE.CanvasTexture(rough.canvas),
  };
}
export function kitSurfaces(keeper: boolean) {
  const key = keeper ? "keeper" : "outfield";
  let hit = surfaces.get(key);
  if (!hit) {
    hit = buildSurfaces(keeper);
    hit.normal.anisotropy = 4;
    hit.roughness.anisotropy = 4;
    surfaces.set(key, hit);
  }
  return hit;
}
