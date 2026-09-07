import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { audio } from "../systems/AudioSystem";
import { netTexture } from "./textures";
const HALF = 3.66;
const HEIGHT = 2.44;
const BACK_TOP = [1.05, 2.2] as const; // depth, height of the rear top bar
const BACK_FOOT = 2.15; // depth of the rear ground bar
type P = [number, number, number];
/**
 * The net is four tiled panels rather than line segments, so it catches light,
 * casts a real shadow and reads as fabric from the broadcast camera.
 */
function Net({ side }: { side: number }) {
  const geometry = useMemo(() => {
    const position: number[] = [];
    const uv: number[] = [];
    const scale = 0.42; // metres per texture tile
    const quad = (a: P, b: P, c: P, d: P) => {
      const u = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / scale;
      const v = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / scale;
      position.push(...a, ...b, ...c, ...a, ...c, ...d);
      uv.push(0, 0, u, 0, u, v, 0, 0, u, v, 0, v);
    };
    const x = (depth: number) => side * (52.5 + depth);
    const front = (z: number, y: number): P => [x(0), y, z];
    const top = (z: number): P => [x(BACK_TOP[0]), BACK_TOP[1], z];
    const foot = (z: number): P => [x(BACK_FOOT), 0, z];
    quad(front(-HALF, HEIGHT), front(HALF, HEIGHT), top(HALF), top(-HALF));
    quad(top(-HALF), top(HALF), foot(HALF), foot(-HALF));
    for (const z of [-HALF, HALF])
      quad(front(z, 0), front(z, HEIGHT), top(z), foot(z));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, [side]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={netTexture()}
        alphaMap={netTexture()}
        transparent
        alphaTest={0.32}
        depthWrite
        side={THREE.DoubleSide}
        roughness={0.85}
        color="#eef3ee"
      />
    </mesh>
  );
}
function Frame({ side }: { side: number }) {
  const white = (
    <meshStandardMaterial color="#f7f9f4" roughness={0.32} metalness={0.05} />
  );
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      onCollisionEnter={() => audio.play("post")}
    >
      {[-HALF, HALF].map((z) => (
        <group key={z}>
          <mesh castShadow position={[side * 52.5, HEIGHT / 2, z]}>
            <cylinderGeometry args={[0.06, 0.06, HEIGHT, 14]} />
            {white}
          </mesh>
          <CuboidCollider
            args={[0.06, HEIGHT / 2, 0.06]}
            position={[side * 52.5, HEIGHT / 2, z]}
          />
          <mesh
            castShadow
            position={[
              side * (52.5 + BACK_TOP[0] / 2),
              (HEIGHT + BACK_TOP[1]) / 2,
              z,
            ]}
            rotation={[0, 0, side * (Math.PI / 2 - 0.224)]}
          >
            <cylinderGeometry args={[0.035, 0.035, BACK_TOP[0] + 0.1, 8]} />
            {white}
          </mesh>
          <mesh
            castShadow
            position={[
              side * (52.5 + (BACK_TOP[0] + BACK_FOOT) / 2),
              BACK_TOP[1] / 2,
              z,
            ]}
            rotation={[0, 0, side * 0.464]}
          >
            <cylinderGeometry args={[0.035, 0.035, 2.45, 8]} />
            {white}
          </mesh>
        </group>
      ))}
      <mesh
        castShadow
        position={[side * 52.5, HEIGHT, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.06, 0.06, HALF * 2, 14]} />
        {white}
      </mesh>
      <CuboidCollider
        args={[0.06, 0.06, HALF]}
        position={[side * 52.5, HEIGHT, 0]}
      />
      <mesh
        position={[side * (52.5 + BACK_TOP[0]), BACK_TOP[1], 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.035, 0.035, HALF * 2, 8]} />
        {white}
      </mesh>
      <mesh
        position={[side * (52.5 + BACK_FOOT), 0.04, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.035, 0.035, HALF * 2, 8]} />
        {white}
      </mesh>
    </RigidBody>
  );
}
export function Goals() {
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Frame side={side} />
          <Net side={side} />
        </group>
      ))}
    </>
  );
}
