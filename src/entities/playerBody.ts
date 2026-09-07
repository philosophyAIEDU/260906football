import * as THREE from "three";
/**
 * Procedural footballer: one shared skinned body mesh plus a per-player kit
 * atlas. Twenty-two players therefore cost one geometry, one draw call each and
 * no downloaded assets, while deforming smoothly instead of showing the gaps a
 * rigid part-by-part rig leaves at every joint.
 *
 * Proportions follow a 1.80 m athlete at roughly seven and a half heads tall,
 * and every cross section can be reshaped per angle so the silhouette carries
 * deltoids, a spine groove, calves, a jaw and a nose rather than plain ovals.
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
  ["hips", null, [0, 0.95, 0]],
  ["spine", "hips", [0, 0.155, 0]],
  ["chest", "spine", [0, 0.185, 0]],
  ["neck", "chest", [0, 0.185, 0]],
  ["head", "neck", [0, 0.085, 0]],
  ["armL", "chest", [0.168, 0.13, 0]],
  ["foreL", "armL", [0, -0.275, 0]],
  ["handL", "foreL", [0, -0.255, 0]],
  ["armR", "chest", [-0.168, 0.13, 0]],
  ["foreR", "armR", [0, -0.275, 0]],
  ["handR", "foreR", [0, -0.255, 0]],
  ["thighL", "hips", [0.09, -0.015, 0]],
  ["shinL", "thighL", [0, -0.43, 0]],
  ["footL", "shinL", [0, -0.425, 0]],
  ["thighR", "hips", [-0.09, -0.015, 0]],
  ["shinR", "thighR", [0, -0.43, 0]],
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
// ---------------------------------------------------------------------------
// Cross section shaping
// ---------------------------------------------------------------------------
/** Ring angles. The mesh faces +Z, so zero is the front of the body. */
const A_FRONT = 0,
  A_LEFT = Math.PI / 2,
  A_BACK = Math.PI,
  A_RIGHT = -Math.PI / 2;
/**
 * Vertical tubes start a quarter turn early, which puts the texture seams on
 * the flanks and leaves the chest and the back on clean texture centres.
 */
const SWEEP = { from: A_RIGHT, to: A_RIGHT + Math.PI * 2 };
/** Texture coordinate of the chest and of the spine, around any vertical part. */
export const FRONT = 0.25;
export const BACK = 0.75;
type Modulate = (angle: number) => number;
/** Smooth radial bump centred on one angle, as a fraction of the radius. */
function lobe(centre: number, width: number, amount: number): Modulate {
  return (a) => {
    const d = Math.atan2(Math.sin(a - centre), Math.cos(a - centre));
    const t = 1 - Math.min(1, Math.abs(d) / width);
    return amount * t * t * (3 - 2 * t);
  };
}
const flanks = (width: number, amount: number) => [
  lobe(A_LEFT, width, amount),
  lobe(A_RIGHT, width, amount),
];
/** Combines bumps into a radius multiplier. */
const shaped = (...parts: Modulate[]): Modulate =>
  parts.length === 0
    ? () => 1
    : (a) => {
        let sum = 1;
        for (const part of parts) sum += part(a);
        return sum;
      };
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
  /** Per-angle radius multiplier that gives the section its anatomy. */
  m?: Modulate;
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
  head: { u0: 0, v0: 0.02, u1: 0.44, v1: 0.5 },
  hair: { u0: 0.44, v0: 0.02, u1: 0.68, v1: 0.5 },
  boot: { u0: 0.68, v0: 0.02, u1: 0.95, v1: 0.5 },
} satisfies Record<string, Region>;
interface Builder {
  position: number[];
  uv: number[];
  index: number[];
  skinIndex: number[];
  skinWeight: number[];
  /** Coincident ring ends, welded after normals are computed. */
  seams: [number, number][];
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
  options: {
    from?: number;
    to?: number;
    floor?: number;
    /** Mirrors the ring so a left and a right limb share texture sides. */
    mirror?: boolean;
  } = {},
) {
  const { from = 0, to = Math.PI * 2, floor, mirror = false } = options;
  const closed = to - from >= Math.PI * 2 - 1e-6;
  const start = build.position.length / 3;
  const stride = segments + 1;
  for (const section of sections) {
    const k = section.k ?? 1;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = from + (to - from) * t;
      const scale = section.m ? section.m(a) : 1;
      const su = superellipse(Math.sin(a), k) * section.r[0] * scale;
      const sv = superellipse(Math.cos(a), k) * section.r[1] * scale;
      // Sweeping along Z mirrors the ring so the winding still faces outward.
      let x = section.c[0] + (axis === "y" && !mirror ? su : -su);
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
  // The duplicate vertex that closes the ring carries u = 1, so the last face
  // must use it: wrapping back to u = 0 smears the whole strip across one quad.
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = start + j * stride + i;
      const b = a + stride;
      if (mirror && axis === "y")
        build.index.push(a, b, a + 1, a + 1, b, b + 1);
      else build.index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  if (closed)
    for (let j = 0; j < sections.length; j++)
      build.seams.push([start + j * stride, start + j * stride + segments]);
}
type Row = [number, number, number, Weight[], Modulate?];
/** Rings for one arm or leg, mirrored by `side` (+1 is the player's left). */
const limb = (side: number, x: number, rows: Row[]): Section[] => {
  const first = rows[0][0];
  const span = rows[rows.length - 1][0] - first || 1;
  return rows.map(([y, rx, rz, w, m]) => ({
    c: [side * x, y, 0] as [number, number, number],
    r: [rx, rz] as [number, number],
    v: (y - first) / span,
    w: w.map(([name, value]) => [
      (side > 0 ? name : name.replace(/L$/, "R")) as BoneName,
      value,
    ]),
    m,
  }));
};
// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------
const hipsOnly: Weight[] = [["hips", 1]];
const spineHips: Weight[] = [
  ["hips", 0.5],
  ["spine", 0.5],
];
const spineOnly: Weight[] = [["spine", 1]];
const spineChest: Weight[] = [
  ["spine", 0.55],
  ["chest", 0.45],
];
const chestOnly: Weight[] = [["chest", 1]];
const chestNeck: Weight[] = [
  ["chest", 0.45],
  ["neck", 0.55],
];
const neckOnly: Weight[] = [["neck", 1]];
const neckHead: Weight[] = [
  ["neck", 0.4],
  ["head", 0.6],
];
const headOnly: Weight[] = [["head", 1]];
const glute = shaped(lobe(A_BACK, 1.15, 0.11));
const seat = shaped(lobe(A_BACK, 1.15, 0.06));
const groove = shaped(lobe(A_BACK, 0.3, -0.055));
const ribs = shaped(lobe(A_BACK, 0.3, -0.05), ...flanks(0.85, 0.03));
const pecs = shaped(
  lobe(A_BACK, 0.3, -0.045),
  lobe(A_FRONT, 0.32, -0.05),
  ...flanks(0.8, 0.05),
);
const yoke = shaped(
  lobe(A_BACK, 0.34, -0.03),
  lobe(A_FRONT, 0.8, 0.035),
  ...flanks(0.95, 0.09),
);
function buildGeometry(): THREE.BufferGeometry {
  const build: Builder = {
    position: [],
    uv: [],
    index: [],
    skinIndex: [],
    skinWeight: [],
    seams: [],
  };
  // ---- torso, from the shorts hem to the base of the skull ---------------
  const torsoRows: [number, number, number, Weight[], number, Modulate?][] = [
    [0.745, 0.012, 0.01, hipsOnly, 0.6],
    [0.752, 0.112, 0.094, hipsOnly, 0.6],
    [0.759, 0.168, 0.136, hipsOnly, 0.66],
    [0.8, 0.17, 0.138, hipsOnly, 0.7],
    [0.856, 0.166, 0.134, hipsOnly, 0.74],
    [0.896, 0.16, 0.128, hipsOnly, 0.82, glute],
    [0.95, 0.152, 0.12, hipsOnly, 0.9, seat],
    [1.01, 0.14, 0.109, spineHips, 0.96],
    [1.1, 0.133, 0.104, spineOnly, 1, groove],
    [1.19, 0.144, 0.109, spineChest, 1, ribs],
    [1.29, 0.163, 0.121, chestOnly, 1, pecs],
    [1.36, 0.171, 0.122, chestOnly, 1, pecs],
    [1.42, 0.16, 0.115, chestOnly, 1, yoke],
    [1.452, 0.128, 0.102, chestNeck, 1],
    [1.472, 0.083, 0.075, chestNeck, 1],
    [1.497, 0.062, 0.064, neckOnly, 1],
    [1.545, 0.058, 0.06, neckHead, 1],
  ];
  tube(
    build,
    torsoRows.map(([y, rx, rz, w, k, m]) => ({
      c: [0, y, 0] as [number, number, number],
      r: [rx, rz] as [number, number],
      v: (y - 0.745) / 0.8,
      w,
      k,
      m,
    })),
    "y",
    34,
    regions.torso,
    SWEEP,
  );
  // ---- head: jaw, chin, cheekbones, nose, brow, ears, occiput ------------
  const jaw = shaped(lobe(A_FRONT, 0.55, 0.07), ...flanks(0.7, -0.13));
  const chin = shaped(lobe(A_FRONT, 0.42, 0.12), ...flanks(0.7, -0.09));
  const mouth = shaped(lobe(A_FRONT, 0.5, 0.03));
  const cheek = shaped(
    lobe(A_FRONT, 0.34, 0.19),
    ...flanks(0.3, 0.1),
    lobe(A_BACK, 1, 0.035),
  );
  const nose = shaped(
    lobe(A_FRONT, 0.3, 0.3),
    ...flanks(0.3, 0.11),
    lobe(A_BACK, 1, 0.045),
  );
  const eyes = shaped(
    lobe(A_FRONT, 0.34, 0.05),
    ...flanks(0.32, 0.1),
    lobe(A_BACK, 1, 0.045),
  );
  const brow = shaped(lobe(A_FRONT, 0.75, 0.045), lobe(A_BACK, 1, 0.04));
  const skullRows: [number, number, number, Modulate?][] = [
    [1.47, 0.056, 0.06],
    [1.508, 0.061, 0.073],
    [1.542, 0.067, 0.085, jaw],
    [1.572, 0.071, 0.091, chin],
    [1.604, 0.074, 0.095, mouth],
    [1.638, 0.077, 0.098, nose],
    [1.672, 0.079, 0.1, cheek],
    [1.7, 0.079, 0.1, eyes],
    [1.724, 0.078, 0.099, brow],
    [1.752, 0.075, 0.094],
    [1.78, 0.065, 0.081],
    [1.798, 0.04, 0.051],
    [1.806, 0.006, 0.008],
  ];
  tube(
    build,
    skullRows.map(([y, rx, rz, m]) => ({
      c: [0, y, 0] as [number, number, number],
      r: [rx, rz] as [number, number],
      v: (y - 1.47) / 0.336,
      w: headOnly,
      m,
    })),
    "y",
    40,
    regions.head,
    SWEEP,
  );
  // ---- arms and legs -----------------------------------------------------
  const deltoid = shaped(lobe(A_LEFT, 1.1, 0.06));
  const biceps = shaped(lobe(A_FRONT, 1, 0.055), lobe(A_BACK, 1, 0.05));
  const thumb = shaped(lobe(A_RIGHT, 0.5, 0.24));
  const palm = shaped(lobe(A_RIGHT, 0.6, 0.12));
  const quad = shaped(lobe(A_FRONT, 1.1, 0.05), lobe(A_BACK, 1.1, 0.045));
  const knee = shaped(lobe(A_FRONT, 0.7, 0.07), lobe(A_BACK, 0.6, -0.04));
  const ankle = shaped(...flanks(0.4, 0.09));
  const calf = shaped(lobe(A_BACK, 0.95, 0.1), lobe(A_FRONT, 0.5, -0.04));
  const shin = shaped(lobe(A_FRONT, 0.45, -0.05));
  for (const side of [1, -1]) {
    tube(
      build,
      limb(side, 0.168, [
        [1.47, 0.07, 0.072, [["chest", 0.62], ["armL", 0.38]], deltoid],
        [1.432, 0.077, 0.079, [["chest", 0.28], ["armL", 0.72]], deltoid],
        [1.39, 0.07, 0.072, [["armL", 1]]],
        [1.34, 0.062, 0.064, [["armL", 1]], biceps],
        [1.3, 0.057, 0.059, [["armL", 1]], biceps],
        [1.288, 0.061, 0.063, [["armL", 1]]],
        [1.272, 0.05, 0.052, [["armL", 1]]],
        [1.21, 0.046, 0.048, [["armL", 1]]],
        [1.16, 0.043, 0.045, [["armL", 0.6], ["foreL", 0.4]]],
        [1.12, 0.045, 0.047, [["foreL", 1]]],
        [1.05, 0.043, 0.045, [["foreL", 1]]],
        [0.975, 0.034, 0.036, [["foreL", 1]]],
        [0.93, 0.03, 0.032, [["foreL", 0.5], ["handL", 0.5]]],
        [0.892, 0.04, 0.026, [["handL", 1]], thumb],
        [0.845, 0.041, 0.027, [["handL", 1]], palm],
        [0.8, 0.036, 0.024, [["handL", 1]]],
        [0.762, 0.021, 0.015, [["handL", 1]]],
        [0.746, 0.005, 0.004, [["handL", 1]]],
      ]),
      "y",
      18,
      regions.arm,
      { ...SWEEP, mirror: side < 0 },
    );
    tube(
      build,
      limb(side, 0.09, [
        [0.965, 0.094, 0.103, [["hips", 0.45], ["thighL", 0.55]]],
        [0.9, 0.089, 0.099, [["thighL", 1]], quad],
        [0.82, 0.081, 0.093, [["thighL", 1]], quad],
        [0.73, 0.073, 0.085, [["thighL", 1]], quad],
        [0.64, 0.064, 0.074, [["thighL", 1]]],
        [0.57, 0.057, 0.064, [["thighL", 1]]],
        [0.52, 0.057, 0.059, [["thighL", 1]], knee],
        [0.505, 0.056, 0.058, [["thighL", 0.45], ["shinL", 0.55]], knee],
        [0.48, 0.054, 0.057, [["shinL", 1]], knee],
        [0.44, 0.057, 0.062, [["shinL", 1]], calf],
        [0.4, 0.057, 0.062, [["shinL", 1]], calf],
        [0.34, 0.051, 0.055, [["shinL", 1]], shin],
        [0.25, 0.042, 0.045, [["shinL", 1]], shin],
        [0.16, 0.035, 0.037, [["shinL", 1]], shin],
        [0.12, 0.033, 0.035, [["shinL", 0.6], ["footL", 0.4]], ankle],
        [0.095, 0.033, 0.036, [["footL", 1]]],
      ]),
      "y",
      20,
      regions.leg,
      { ...SWEEP, mirror: side < 0 },
    );
    const foot: Weight[] = [[side > 0 ? "footL" : "footR", 1]];
    tube(
      build,
      (
        [
          [-0.09, 0.086, 0.01, 0.01],
          [-0.08, 0.083, 0.034, 0.032],
          [-0.06, 0.076, 0.045, 0.048],
          [-0.025, 0.068, 0.049, 0.052],
          [0.025, 0.06, 0.05, 0.048],
          [0.075, 0.052, 0.048, 0.039],
          [0.12, 0.045, 0.043, 0.029],
          [0.155, 0.039, 0.035, 0.02],
          [0.175, 0.035, 0.013, 0.008],
        ] as [number, number, number, number][]
      ).map(([z, cy, rx, ry]) => ({
        c: [side * 0.09, cy, z] as [number, number, number],
        r: [rx, ry] as [number, number],
        v: (z + 0.09) / 0.265,
        w: foot,
        k: 0.7,
      })),
      "z",
      16,
      regions.boot,
      { floor: 0.013 },
    );
  }
  // ---- hair ------------------------------------------------------------
  // A closed cap whose lower front rings sit inside the skull. The hairline is
  // therefore an intersection rather than an open rim with a visible edge.
  const headRadius = (y: number): [number, number] => {
    if (y <= skullRows[0][0]) return [skullRows[0][1], skullRows[0][2]];
    for (let i = 1; i < skullRows.length; i++) {
      const [y1, rx1, rz1] = skullRows[i];
      if (y > y1) continue;
      const [y0, rx0, rz0] = skullRows[i - 1];
      const t = (y - y0) / (y1 - y0);
      return [rx0 + (rx1 - rx0) * t, rz0 + (rz1 - rz0) * t];
    }
    const last = skullRows[skullRows.length - 1];
    return [last[1], last[2]];
  };
  const hairRows: [number, number, number][] = [
    [1.612, 0.86, 0.3],
    [1.652, 0.88, 0.28],
    [1.692, 0.9, 0.26],
    [1.726, 0.94, 0.2],
    [1.75, 0.99, 0.12],
    [1.772, 1.05, 0.05],
    [1.794, 1.07, 0.03],
    [1.812, 1.02, 0.02],
  ];
  tube(
    build,
    hairRows.map(([y, k, back]) => {
      const [rx, rz] = headRadius(y);
      return {
        c: [0, y, 0] as [number, number, number],
        r: [rx * k + 0.002, rz * k + 0.002] as [number, number],
        v: (y - 1.612) / 0.2,
        w: headOnly,
        m: shaped(lobe(A_BACK, 2.4, back)),
      };
    }),
    "y",
    40,
    regions.hair,
    SWEEP,
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
  // Average the normals of the two vertices that sit on top of each other at a
  // ring's seam, otherwise a hard shading line runs down every limb.
  const normal = geometry.getAttribute("normal");
  for (const [a, b] of build.seams) {
    const x = normal.getX(a) + normal.getX(b),
      y = normal.getY(a) + normal.getY(b),
      z = normal.getZ(a) + normal.getZ(b);
    const length = Math.hypot(x, y, z) || 1;
    normal.setXYZ(a, x / length, y / length, z / length);
    normal.setXYZ(b, x / length, y / length, z / length);
  }
  // Deformed limbs reach past the rest pose, so cull against a generous sphere.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
  return geometry;
}
let shared: THREE.BufferGeometry | null = null;
export function playerGeometry() {
  return (shared ??= buildGeometry());
}
