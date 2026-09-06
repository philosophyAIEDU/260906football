import { useEffect, useMemo, useState } from "react";
import { assetConfig } from "../data/assets";
import * as THREE from "three";
function Mark({ points }: { points: [number, number][] }) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const [ax, az] = points[i],
        [bx, bz] = points[i + 1];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      const dx = (-(bz - az) / length) * 0.055,
        dz = ((bx - ax) / length) * 0.055;
      vertices.push(
        ax + dx,
        0.018,
        az + dz,
        bx + dx,
        0.018,
        bz + dz,
        ax - dx,
        0.018,
        az - dz,
        ax - dx,
        0.018,
        az - dz,
        bx + dx,
        0.018,
        bz + dz,
        bx - dx,
        0.018,
        bz - dz,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#f1f0da"
        roughness={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
const rectangle = (
  x: number,
  z: number,
  w: number,
  h: number,
): [number, number][] => [
  [x, z],
  [x + w, z],
  [x + w, z],
  [x + w, z + h],
  [x + w, z + h],
  [x, z + h],
  [x, z + h],
  [x, z],
];
function Arc({
  x = 0,
  z = 0,
  r = 9.15,
  start = 0,
  end = Math.PI * 2,
}: {
  x?: number;
  z?: number;
  r?: number;
  start?: number;
  end?: number;
}) {
  const points: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const a = start + ((end - start) * i) / 64,
      b = start + ((end - start) * (i + 1)) / 64;
    points.push(
      [x + Math.cos(a) * r, z + Math.sin(a) * r],
      [x + Math.cos(b) * r, z + Math.sin(b) * r],
    );
  }
  return <Mark points={points} />;
}
export function Pitch() {
  const [custom, setCustom] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!assetConfig.pitchTexture) return;
    let alive = true;
    let loaded: THREE.Texture | undefined;
    new THREE.TextureLoader().load(
      assetConfig.pitchTexture,
      (t) => {
        loaded = t;
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(25, 16);
        if (alive) setCustom(t);
        else t.dispose();
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, []);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#66952c";
    ctx.fillRect(0, 0, 1024, 1024);
    let seed = 3187;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 240000; i++) {
      const x = random() * 1024,
        y = random() * 1024;
      const shade = random();
      ctx.strokeStyle =
        shade > 0.5
          ? `rgba(166,191,73,${0.1 + random() * 0.22})`
          : `rgba(38,76,16,${0.12 + random() * 0.25})`;
      ctx.lineWidth = 0.5 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 3, y - 1 - random() * 5);
      ctx.stroke();
    }
    for (let i = 0; i < 200; i++) {
      const x = random() * 1024,
        y = random() * 1024,
        r = 8 + random() * 35;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, "rgba(184,173,72,.045)");
      gradient.addColorStop(1, "rgba(184,173,72,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(16, 10);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.025, 0]}
      >
        <planeGeometry args={[132, 94]} />
        <meshStandardMaterial color="#497a29" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[105, 68]} />
        <meshStandardMaterial
          map={custom ?? texture}
          bumpMap={custom ?? texture}
          bumpScale={0.025}
          roughness={0.96}
        />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-49.875 + i * 10.5, 0.005, 0]}
          receiveShadow
        >
          <planeGeometry args={[5.25, 68]} />
          <meshStandardMaterial
            color="#b3c756"
            transparent
            opacity={0.09}
            roughness={1}
          />
        </mesh>
      ))}
      <Mark points={[...rectangle(-52.5, -34, 105, 68), [0, -34], [0, 34]]} />
      <Arc />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Mark points={rectangle(s < 0 ? -52.5 : 36, -20.16, 16.5, 40.32)} />
          <Mark points={rectangle(s < 0 ? -52.5 : 47, -9.16, 5.5, 18.32)} />
          <Arc
            x={s * 41.5}
            start={s < 0 ? -1 : Math.PI - 1}
            end={s < 0 ? 1 : Math.PI + 1}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s * 41.5, 0.03, 0]}>
            <circleGeometry args={[0.16, 12]} />
            <meshBasicMaterial color="white" />
          </mesh>
          {[-1, 1].map((z) => (
            <group key={z}>
              <Arc
                x={s * 52.5}
                z={z * 34}
                r={1}
                start={
                  s < 0
                    ? z < 0
                      ? 0
                      : -Math.PI / 2
                    : z < 0
                      ? Math.PI / 2
                      : Math.PI
                }
                end={
                  s < 0
                    ? z < 0
                      ? Math.PI / 2
                      : 0
                    : z < 0
                      ? Math.PI
                      : Math.PI * 1.5
                }
              />
              <mesh position={[s * 52.5, 0.85, z * 34]}>
                <cylinderGeometry args={[0.035, 0.035, 1.7, 6]} />
                <meshStandardMaterial color="#f5f5e0" />
              </mesh>
              <mesh position={[s * 52.5 + 0.22, 1.55, z * 34]}>
                <boxGeometry args={[0.45, 0.3, 0.025]} />
                <meshStandardMaterial color="#ffdd57" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.16, 12]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
}
