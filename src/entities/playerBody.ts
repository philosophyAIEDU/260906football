import * as THREE from "three";
/**
 * Procedural footballer: one shared skinned body mesh plus a per-player kit
 * atlas. Twenty-two players therefore cost one geometry, one draw call each and
 * no downloaded assets, while deforming smoothly instead of showing the gaps a
 * rigid part-by-part rig leaves at every joint.
 */
export const boneNames = [
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "armL",
  "foreL",
  "handL",
  "armR",
  "foreR",
  "handR",
  "thighL",
  "shinL",
  "footL",
  "thighR",
  "shinR",
  "footR",
] as const;
export type BoneName = (typeof boneNames)[number];
export type Bones = Record<BoneName, THREE.Bone>;
const boneIndex = Object.fromEntries(
  boneNames.map((name, i) => [name, i]),
) as Record<BoneName, number>;
/** Bone rest layout: parent plus the offset from it, in metres. */
const skeletonPlan: [BoneName, BoneName | null, [number, number, number]][] = [
  ["hips", null, [0, 0.94, 0]],
  ["spine", "hips", [0, 0.16, 0]],
  ["chest", "spine", [0, 0.18, 0]],
  ["neck", "chest", [0, 0.2, 0]],
  ["head", "neck", [0, 0.08, 0]],
  ["armL", "chest", [0.175, 0.14, 0]],
  ["foreL", "armL", [0, -0.27, 0]],
  ["handL", "foreL", [0, -0.25, 0]],
  ["armR", "chest", [-0.175, 0.14, 0]],
  ["foreR", "armR", [0, -0.27, 0]],
  ["handR", "foreR", [0, -0.25, 0]],
  ["thighL", "hips", [0.085, 0, 0]],
  ["shinL", "thighL", [0, -0.44, 0]],
  ["footL", "shinL", [0, -0.425, 0]],
  ["thighR", "hips", [-0.085, 0, 0]],
  ["shinR", "thighR", [0, -0.44, 0]],
  ["footR", "shinR", [0, -0.425, 0]],
];
export function createSkeleton(): { bones: Bones; skeleton: THREE.Skeleton } {
  const list: THREE.Bone[] = [];
  const map = {} as Bones;
  for (const [name, parent, offset] of skeletonPlan) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(...offset);
    map[name] = bone;
    list.push(bone);
    if (parent) map[parent].add(bone);
  }
  map.hips.updateMatrixWorld(true);
  return { bones: map, skeleton: new THREE.Skeleton(list) };
}
type Weight = [BoneName, number];
interface Section {
  /** Ring centre in rest space. */
  c: [number, number, number];
  /** Ring radii along the two axes of the ring plane. */
  r: [number, number];
  /** Texture coordinate along the part, 0 at the first ring. */
  v: number;
  w: Weight[];
  /** Superellipse exponent: 1 is a true ellipse, lower is boxier. */
  k?: number;
}
interface Region {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}
/** Atlas slots. Painting and UV assignment read the same table. */
export const regions = {
  torso: { u0: 0, v0: 0.5, u1: 0.5, v1: 1 },
  arm: { u0: 0.5, v0: 0.5, u1: 0.75, v1: 1 },
  leg: { u0: 0.75, v0: 0.5, u1: 1, v1: 1 },
  head: { u0: 0, v0: 0.14, u1: 0.34, v1: 0.5 },
  hair: { u0: 0.34, v0: 0.14, u1: 0.62, v1: 0.5 },
  boot: { u0: 0.62, v0: 0.14, u1: 0.9, v1: 0.5 },
} satisfies Record<string, Region>;
interface Builder {
  position: number[];
  uv: number[];
  index: number[];
  skinIndex: number[];
  skinWeight: number[];
}
function pushWeights(build: Builder, w: Weight[]) {
  const total = w.reduce((sum, [, value]) => sum + value, 0) || 1;
  for (let i = 0; i < 4; i++) {
    build.skinIndex.push(w[i] ? boneIndex[w[i][0]] : 0);
    build.skinWeight.push(w[i] ? w[i][1] / total : 0);
  }
}
const superellipse = (a: number, k: number) =>
  k === 1 ? a : Math.sign(a) * Math.abs(a) ** k;
/**
 * Sweeps a closed or partial ring along a chain of sections. `axis` names the
 * sweep direction, so limbs sweep down Y and boots sweep forward along Z.
 */
function tube(
  build: Builder,
  sections: Section[],
  axis: "y" | "z",
  segments: number,
  region: Region,
  options: { from?: number; to?: number; floor?: number } = {},
) {
  const { from = 0, to = Math.PI * 2, floor } = options;
  const closed = to - from >= Math.PI * 2 - 1e-6;
  const start = build.position.length / 3;
  for (const section of sections) {
    const k = section.k ?? 1;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = from + (to - from) * t;
      const su = superellipse(Math.sin(a), k) * section.r[0];
      const sv = superellipse(Math.cos(a), k) * section.r[1];
      // Sweeping along Z mirrors the ring so the winding still faces outward.
      let x = section.c[0] + (axis === "y" ? su : -su);
      let y = section.c[1];
      let z = section.c[2];
      if (axis === "y") z += sv;
      else y += sv;
      if (floor !== undefined && y < floor) y = floor;
      build.position.push(x, y, z);
      build.uv.push(
        region.u0 + (region.u1 - region.u0) * t,
        region.v0 + (region.v1 - region.v0) * section.v,
      );
      pushWeights(build, section.w);
    }
  }
  const stride = segments + 1;
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = start + j * stride + i;
      const b = a + stride;
      const wrap = closed && i === segments - 1 ? 1 - segments : 1;
      build.index.push(a, a + wrap, b, a + wrap, b + wrap, b);
    }
}
/** Rings for one arm or leg, mirrored by `side` (+1 is the player's left). */
const limb = (
  side: number,
  x: number,
  rows: [number, number, number, Weight[]][],
): Section[] => {
  const first = rows[0][0];
  const span = rows[rows.length - 1][0] - first || 1;
  return rows.map(([y, rx, rz, w]) => ({
    c: [side * x, y, 0] as [number, number, number],
    r: [rx, rz] as [number, number],
    v: (y - first) / span,
    w: w.map(([name, value]) => [
      (side > 0 ? name : name.replace(/L$/, "R")) as BoneName,
      value,
    ]),
  }));
};
function buildGeometry(): THREE.BufferGeometry {
  const build: Builder = {
    position: [],
    uv: [],
    index: [],
    skinIndex: [],
    skinWeight: [],
  };
  const hips: Weight[] = [["hips", 1]];
  const torso: Section[] = (
    [
      [0.8, 0.008, 0.006, hips, 0.55],
      [0.807, 0.12, 0.095, hips, 0.55],
      [0.812, 0.168, 0.126, hips, 0.6],
      [0.845, 0.172, 0.128, hips, 0.7],
      [0.88, 0.166, 0.122, hips, 0.78],
      [0.94, 0.157, 0.115, hips, 0.85],
      [1.0, 0.145, 0.104, [["hips", 0.5], ["spine", 0.5]], 0.92],
      [1.1, 0.142, 0.1, [["spine", 1]], 1],
      [1.19, 0.152, 0.104, [["spine", 0.55], ["chest", 0.45]], 1],
      [1.28, 0.176, 0.114, [["chest", 1]], 1],
      [1.36, 0.19, 0.118, [["chest", 1]], 1],
      [1.42, 0.178, 0.113, [["chest", 1]], 1],
      [1.46, 0.126, 0.094, [["chest", 0.45], ["neck", 0.55]], 1],
      [1.5, 0.062, 0.064, [["neck", 1]], 1],
      [1.54, 0.058, 0.06, [["neck", 0.4], ["head", 0.6]], 1],
    ] as [number, number, number, Weight[], number][]
  ).map(([y, rx, rz, w, k]) => ({
    c: [0, y, 0],
    r: [rx, rz],
    v: (y - 0.8) / 0.74,
    w,
    k,
  }));
  tube(build, torso, "y", 24, regions.torso);
  const head: Weight[] = [["head", 1]];
  const skull: [number, number, number][] = [
    [1.5, 0.058, 0.06],
    [1.55, 0.07, 0.075],
    [1.6, 0.085, 0.092],
    [1.66, 0.093, 0.1],
    [1.72, 0.094, 0.101],
    [1.78, 0.088, 0.095],
    [1.82, 0.07, 0.076],
    [1.845, 0.038, 0.042],
    [1.855, 0.006, 0.007],
  ];
  tube(
    build,
    skull.map(([y, rx, rz]) => ({
      c: [0, y, 0] as [number, number, number],
      r: [rx, rz] as [number, number],
      v: (y - 1.5) / 0.355,
      w: head,
    })),
    "y",
    22,
    regions.head,
  );
  for (const side of [1, -1]) {
    tube(
      build,
      limb(side, 0.175, [
        [1.48, 0.072, 0.074, [["chest", 0.6], ["armL", 0.4]]],
        [1.44, 0.075, 0.077, [["chest", 0.3], ["armL", 0.7]]],
        [1.38, 0.065, 0.068, [["armL", 1]]],
        [1.32, 0.058, 0.061, [["armL", 1]]],
        [1.305, 0.061, 0.064, [["armL", 1]]],
        [1.29, 0.05, 0.053, [["armL", 1]]],
        [1.22, 0.046, 0.049, [["armL", 1]]],
        [1.17, 0.044, 0.047, [["armL", 0.6], ["foreL", 0.4]]],
        [1.12, 0.045, 0.048, [["foreL", 1]]],
        [1.04, 0.043, 0.046, [["foreL", 1]]],
        [0.96, 0.035, 0.037, [["foreL", 1]]],
        [0.92, 0.032, 0.034, [["foreL", 0.5], ["handL", 0.5]]],
        [0.87, 0.042, 0.028, [["handL", 1]]],
        [0.81, 0.041, 0.027, [["handL", 1]]],
        [0.77, 0.032, 0.022, [["handL", 1]]],
        [0.752, 0.012, 0.009, [["handL", 1]]],
      ]),
      "y",
      16,
      regions.arm,
    );
    tube(
      build,
      limb(side, 0.085, [
        [0.97, 0.096, 0.101, [["hips", 0.45], ["thighL", 0.55]]],
        [0.9, 0.092, 0.097, [["thighL", 1]]],
        [0.8, 0.084, 0.089, [["thighL", 1]]],
        [0.7, 0.075, 0.079, [["thighL", 1]]],
        [0.6, 0.065, 0.068, [["thighL", 1]]],
        [0.54, 0.058, 0.06, [["thighL", 1]]],
        [0.5, 0.056, 0.058, [["thighL", 0.45], ["shinL", 0.55]]],
        [0.46, 0.054, 0.057, [["shinL", 1]]],
        [0.43, 0.058, 0.063, [["shinL", 1]]],
        [0.39, 0.057, 0.062, [["shinL", 1]]],
        [0.31, 0.05, 0.054, [["shinL", 1]]],
        [0.22, 0.04, 0.043, [["shinL", 1]]],
        [0.14, 0.034, 0.036, [["shinL", 0.6], ["footL", 0.4]]],
        [0.1, 0.034, 0.037, [["footL", 1]]],
      ]),
      "y",
      18,
      regions.leg,
    );
    const foot: Weight[] = [[side > 0 ? "footL" : "footR", 1]];
    tube(
      build,
      (
        [
          [-0.085, 0.075, 0.008, 0.008],
          [-0.075, 0.072, 0.032, 0.03],
          [-0.055, 0.068, 0.042, 0.045],
          [-0.02, 0.062, 0.047, 0.05],
          [0.03, 0.056, 0.048, 0.046],
          [0.08, 0.048, 0.046, 0.037],
          [0.125, 0.041, 0.038, 0.027],
          [0.155, 0.036, 0.022, 0.016],
          [0.168, 0.034, 0.006, 0.005],
        ] as [number, number, number, number][]
      ).map(([z, cy, rx, ry]) => ({
        c: [side * 0.085, cy, z] as [number, number, number],
        r: [rx, ry] as [number, number],
        v: (z + 0.085) / 0.253,
        w: foot,
        k: 0.72,
      })),
      "z",
      14,
      regions.boot,
      { floor: 0.014 },
    );
  }
  const hair: Weight[] = [["head", 1]];
  tube(
    build,
    (
      [
        [1.735, 0.098, 0.105],
        [1.775, 0.095, 0.102],
        [1.815, 0.08, 0.086],
        [1.845, 0.05, 0.055],
        [1.859, 0.008, 0.009],
      ] as [number, number, number][]
    ).map(([y, rx, rz]) => ({
      c: [0, y, 0] as [number, number, number],
      r: [rx, rz] as [number, number],
      v: 0.35 + (y - 1.735) / 0.19,
      w: hair,
    })),
    "y",
    20,
    regions.hair,
  );
  tube(
    build,
    (
      [
        [1.678, 0.083, 0.089],
        [1.706, 0.092, 0.099],
        [1.734, 0.096, 0.103],
        [1.752, 0.097, 0.104],
      ] as [number, number, number][]
    ).map(([y, rx, rz]) => ({
      c: [0, y, 0] as [number, number, number],
      r: [rx, rz] as [number, number],
      v: (y - 1.678) / 0.33,
      w: hair,
    })),
    "y",
    20,
    regions.hair,
    { from: Math.PI * 0.32, to: Math.PI * 1.68 },
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(build.position, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(build.uv, 2));
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(build.skinIndex, 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(build.skinWeight, 4),
  );
  geometry.setIndex(build.index);
  geometry.computeVertexNormals();
  // Deformed limbs reach past the rest pose, so cull against a generous sphere.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
  return geometry;
}
let shared: THREE.BufferGeometry | null = null;
export function playerGeometry() {
  return (shared ??= buildGeometry());
}
