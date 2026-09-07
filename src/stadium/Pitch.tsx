import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { assetConfig } from "../data/assets";
import { grassNormal, turfMap } from "./textures";
/** Painted markings, built as one flat ribbon mesh per group of segments. */
function Mark({ points, width = 0.06 }: { points: [number, number][]; width?: number }) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const [ax, az] = points[i],
        [bx, bz] = points[i + 1];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      const dx = (-(bz - az) / length) * width,
        dz = ((bx - ax) / length) * width;
      vertices.push(
        ax + dx, 0.016, az + dz,
        bx + dx, 0.016, bz + dz,
        ax - dx, 0.016, az - dz,
        ax - dx, 0.016, az - dz,
        bx + dx, 0.016, bz + dz,
        bx - dx, 0.016, bz - dz,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, [points, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#f4f6ec"
        roughness={0.85}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
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
  [x, z], [x + w, z],
  [x + w, z], [x + w, z + h],
  [x + w, z + h], [x, z + h],
  [x, z + h], [x, z],
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
  const points = useMemo(() => {
    const list: [number, number][] = [];
    for (let i = 0; i < 72; i++) {
      const a = start + ((end - start) * i) / 72,
        b = start + ((end - start) * (i + 1)) / 72;
      list.push(
        [x + Math.cos(a) * r, z + Math.sin(a) * r],
        [x + Math.cos(b) * r, z + Math.sin(b) * r],
      );
    }
    return list;
  }, [x, z, r, start, end]);
  return <Mark points={points} />;
}
/** Corner flag with a cloth that answers to the wind. */
function CornerFlag({ x, z, color }: { x: number; z: number; color: string }) {
  const cloth = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!cloth.current) return;
    const t = clock.elapsedTime * 2.4 + x + z;
    cloth.current.rotation.y = Math.sin(t) * 0.22;
    cloth.current.rotation.z = Math.sin(t * 1.7) * 0.1;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.022, 0.026, 1.5, 8]} />
        <meshStandardMaterial color="#eef1e6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.51, 0]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial color="#eef1e6" roughness={0.4} />
      </mesh>
      <group ref={cloth} position={[0, 1.32, 0]}>
        <mesh castShadow position={[0.16, 0, 0]}>
          <planeGeometry args={[0.32, 0.24, 4, 2]} />
          <meshStandardMaterial
            color={color}
            roughness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
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
  const relief = useMemo(() => {
    const map = grassNormal().clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(52, 34);
    return map;
  }, []);
  useEffect(() => () => relief.dispose(), [relief]);
  return (
    <group>
      {/* Concourse concrete, then the mown run-off, then the pitch itself. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, 0]}>
        <planeGeometry args={[220, 180]} />
        <meshStandardMaterial color="#6b757a" roughness={0.98} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[117, 80]} />
        <meshStandardMaterial color="#3f7524" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[105, 68]} />
        <meshStandardMaterial
          map={custom ?? turfMap()}
          normalMap={relief}
          normalScale={new THREE.Vector2(0.6, 0.6)}
          roughness={0.94}
          metalness={0}
        />
      </mesh>
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
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s * 41.5, 0.018, 0]}>
            <circleGeometry args={[0.13, 16]} />
            <meshStandardMaterial color="#f4f6ec" roughness={0.85} />
          </mesh>
          {[-1, 1].map((z) => (
            <group key={z}>
              <Arc
                x={s * 52.5}
                z={z * 34}
                r={1}
                start={s < 0 ? (z < 0 ? 0 : -Math.PI / 2) : z < 0 ? Math.PI / 2 : Math.PI}
                end={s < 0 ? (z < 0 ? Math.PI / 2 : 0) : z < 0 ? Math.PI : Math.PI * 1.5}
              />
              <CornerFlag
                x={s * 52.5}
                z={z * 34}
                color={z < 0 ? "#f4d13d" : "#e8442f"}
              />
            </group>
          ))}
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[0.13, 16]} />
        <meshStandardMaterial color="#f4f6ec" roughness={0.85} />
      </mesh>
    </group>
  );
}
