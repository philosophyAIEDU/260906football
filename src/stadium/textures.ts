import * as THREE from "three";
/**
 * Procedural textures for the venue. Everything is generated once, lazily, so
 * the game still ships with no binary assets while looking like a broadcast.
 */
const cache = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture) {
  const hit = cache.get(key);
  if (hit) return hit;
  const texture = make();
  cache.set(key, texture);
  return texture;
}
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
/** Soft round falloff used for contact shadows and selection glows. */
export const softCircle = () =>
  once("soft", () => {
    const { canvas, ctx } = surface(128);
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.55, "rgba(255,255,255,.72)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
/** Whole-pitch colour map: mowing bands, wear and shading, one metre ≈ 19 px. */
export const turfMap = () =>
  once("turf", () => {
    const w = 2048,
      h = 1328;
    const { canvas, ctx } = surface(w, h);
    const random = seeded(7717);
    ctx.fillStyle = "#4e8a2b";
    ctx.fillRect(0, 0, w, h);
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? "#57972f" : "#487f27";
      ctx.fillRect((i * w) / bands, 0, w / bands + 1, h);
    }
    // Mower turn marks at both ends of every band.
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? "#3e7222" : "#5da032";
      ctx.fillRect((i * w) / bands, 0, w / bands + 1, 26);
      ctx.fillRect((i * w) / bands, h - 26, w / bands + 1, 26);
    }
    ctx.globalAlpha = 1;
    // Broad colour drift so the bands do not read as flat paint.
    for (let i = 0; i < 220; i++) {
      const x = random() * w,
        y = random() * h,
        r = 60 + random() * 220;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      const light = random() > 0.5;
      glow.addColorStop(
        0,
        light ? "rgba(150,196,88,.10)" : "rgba(36,66,20,.12)",
      );
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Worn turf in the goalmouths, centre circle and penalty spots.
    const wear = (cx: number, cy: number, rx: number, ry: number, a: number) => {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      glow.addColorStop(0, `rgba(129,120,62,${a})`);
      glow.addColorStop(0.7, `rgba(120,116,66,${a * 0.4})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = glow;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    };
    wear(w * 0.03, h / 2, 150, 210, 0.34);
    wear(w * 0.97, h / 2, 150, 210, 0.34);
    wear(w * 0.105, h / 2, 60, 60, 0.3);
    wear(w * 0.895, h / 2, 60, 60, 0.3);
    wear(w / 2, h / 2, 190, 190, 0.16);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 26000; i++) {
      const x = random() * w,
        y = random() * h;
      ctx.fillStyle =
        random() > 0.5
          ? `rgba(168,203,96,${random() * 0.28})`
          : `rgba(30,58,16,${random() * 0.3})`;
      ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 3);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    return texture;
  });
/** Tileable grass relief, tiled far more densely than the colour map. */
export const grassNormal = () =>
  once("grassNormal", () => {
    const size = 256;
    const { canvas, ctx } = surface(size);
    const random = seeded(4241);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const height = new Float32Array(size * size);
    for (let i = 0; i < 9000; i++) {
      const x = random() * size,
        y = random() * size;
      const length = 3 + random() * 6,
        lean = (random() - 0.5) * 3;
      const value = random() * 2 - 1;
      for (let s = 0; s < length; s++) {
        const px = Math.round(x + (lean * s) / length) & (size - 1);
        const py = Math.round(y - s) & (size - 1);
        height[py * size + px] += value * (1 - s / length) * 0.5;
      }
    }
    const image = ctx.createImageData(size, size);
    const sample = (x: number, y: number) =>
      height[(y & (size - 1)) * size + (x & (size - 1))];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = sample(x + 1, y) - sample(x - 1, y);
        const dy = sample(x, y + 1) - sample(x, y - 1);
        const i = (y * size + x) * 4;
        image.data[i] = THREE.MathUtils.clamp(128 - dx * 90, 0, 255);
        image.data[i + 1] = THREE.MathUtils.clamp(128 - dy * 90, 0, 255);
        image.data[i + 2] = 235;
        image.data[i + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  });
/** Goal netting: square mesh on transparent, tiled across the net panels. */
export const netTexture = () =>
  once("net", () => {
    const size = 128;
    const { canvas, ctx } = surface(size);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const p = (i * size) / 4;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
/** Stand seating, tiled across each tier. */
export const seatTexture = (a: string, b: string) =>
  once(`seats-${a}-${b}`, () => {
    const { canvas, ctx } = surface(64, 32);
    const random = seeded(90210);
    ctx.fillStyle = "#1b2229";
    ctx.fillRect(0, 0, 64, 32);
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = random() > 0.5 ? a : b;
        ctx.fillRect(i * 8 + 1, row * 16 + 2, 6, 12);
      }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
/** Perimeter LED board artwork. */
export function boardTexture(text: string, accent: string) {
  return once(`board-${text}`, () => {
    const { canvas, ctx } = surface(1024, 128);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
    gradient.addColorStop(0, "#0b1620");
    gradient.addColorStop(0.5, "#14283a");
    gradient.addColorStop(1, "#0b1620");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 1024, 5);
    ctx.fillRect(0, 123, 1024, 5);
    ctx.font = "800 62px Barlow Condensed, Arial Narrow, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#eef6ff";
    ctx.fillText(text, 512, 68);
    ctx.globalAlpha = 0.12; // pixel grid, so the board reads as LED
    ctx.fillStyle = "#000";
    for (let x = 0; x < 1024; x += 4) ctx.fillRect(x, 0, 2, 128);
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  });
}
/**
 * Match ball. The classic pattern is the Voronoi diagram of an icosahedron's
 * twelve vertices (pentagons) and twenty face centres (hexagons), so the panel
 * layout is derived rather than hand drawn.
 */
export const ballTexture = () =>
  once("ball", () => {
    const w = 1024,
      h = 512;
    const { canvas, ctx } = surface(w, h);
    const t = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ];
    const norm = (v: number[]) => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    const pent = raw.map(norm);
    const hex: number[][] = [];
    for (let i = 0; i < 12; i++)
      for (let j = i + 1; j < 12; j++)
        for (let k = j + 1; k < 12; k++) {
          const dot = (a: number[], b: number[]) =>
            a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
          const near = 0.4; // adjacent icosahedron vertices meet at 1/sqrt(5)
          if (
            dot(pent[i], pent[j]) > near &&
            dot(pent[j], pent[k]) > near &&
            dot(pent[i], pent[k]) > near
          )
            hex.push(
              norm([
                pent[i][0] + pent[j][0] + pent[k][0],
                pent[i][1] + pent[j][1] + pent[k][1],
                pent[i][2] + pent[j][2] + pent[k][2],
              ]),
            );
        }
    const centres = [...pent, ...hex];
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const theta = (y / (h - 1)) * Math.PI;
      const sy = Math.cos(theta),
        sr = Math.sin(theta);
      for (let x = 0; x < w; x++) {
        const phi = (x / w) * Math.PI * 2;
        const dir = [sr * Math.cos(phi), sy, sr * Math.sin(phi)];
        let best = -2,
          second = -2,
          index = 0;
        for (let c = 0; c < centres.length; c++) {
          const d =
            dir[0] * centres[c][0] +
            dir[1] * centres[c][1] +
            dir[2] * centres[c][2];
          if (d > best) {
            second = best;
            best = d;
            index = c;
          } else if (d > second) second = d;
        }
        const seam = best - second < 0.028;
        const tint = index < 12 ? [24, 34, 48] : [246, 245, 236];
        const i = (y * w + x) * 4;
        image.data[i] = seam ? 92 : tint[0];
        image.data[i + 1] = seam ? 98 : tint[1];
        image.data[i + 2] = seam ? 104 : tint[2];
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const random = seeded(1234);
    ctx.globalAlpha = 0.06; // scuffs
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = random() > 0.5 ? "#000" : "#fff";
      ctx.fillRect(random() * w, random() * h, 2 + random() * 5, 2);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  });
/** Sky dome gradient, also used as the fog and background tone. */
export const skyTexture = () =>
  once("sky", () => {
    const { canvas, ctx } = surface(8, 256);
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#2f6ea8");
    gradient.addColorStop(0.42, "#7fb2d4");
    gradient.addColorStop(0.62, "#bcd7e4");
    gradient.addColorStop(0.8, "#dbe6e5");
    gradient.addColorStop(1, "#c9d6ce");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
