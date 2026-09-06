import type { Vec } from "./types";
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const normalize = (x: number, z: number): Vec => {
  const l = Math.hypot(x, z);
  return l > 0.0001 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
};
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.z * b.z;
export const angleLerp = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * clamp(t, 0, 1);
export function cameraRelative(x: number, y: number, forward: Vec): Vec {
  const f = normalize(forward.x, forward.z);
  return normalize(-f.z * x + f.x * y, f.x * x + f.z * y);
}
export function segmentDistance(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = clamp(
    ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
    0,
    1,
  );
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
