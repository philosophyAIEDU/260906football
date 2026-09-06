import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { audio } from "../systems/AudioSystem";
function Net({ side }: { side: number }) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const add = (a: number[], b: number[]) => {
      points.push(
        new THREE.Vector3(...(a as [number, number, number])),
        new THREE.Vector3(...(b as [number, number, number])),
      );
    };
    for (let z = -3.66; z <= 3.67; z += 0.3) {
      add([side * 54.5, 0, z], [side * 54.5, 2.44, z]);
      add([side * 52.5, 2.44, z], [side * 54.5, 2.44, z]);
    }
    for (let y = 0; y <= 2.45; y += 0.3) {
      add([side * 54.5, y, -3.66], [side * 54.5, y, 3.66]);
      for (const z of [-3.66, 3.66])
        add([side * 52.5, y, z], [side * 54.5, y, z]);
    }
    for (let x = 52.5; x < 54.6; x += 0.3) {
      for (const z of [-3.66, 3.66]) add([side * x, 0, z], [side * x, 2.44, z]);
      add([side * x, 2.44, -3.66], [side * x, 2.44, 3.66]);
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [side]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#f5f7f0" transparent opacity={0.45} />
    </lineSegments>
  );
}
export function Goals() {
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RigidBody
            type="fixed"
            colliders={false}
            onCollisionEnter={() => audio.play("post")}
          >
            {[-3.72, 3.72].map((z) => (
              <group key={z}>
                <mesh castShadow position={[side * 52.5, 1.25, z]}>
                  <cylinderGeometry args={[0.06, 0.06, 2.5, 10]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.4} />
                </mesh>
                <CuboidCollider
                  args={[0.06, 1.25, 0.06]}
                  position={[side * 52.5, 1.25, z]}
                />
              </group>
            ))}
            <mesh
              castShadow
              position={[side * 52.5, 2.5, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.06, 0.06, 7.5, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
            <CuboidCollider
              args={[0.06, 0.06, 3.75]}
              position={[side * 52.5, 2.5, 0]}
            />
          </RigidBody>
          <Net side={side} />
        </group>
      ))}
    </>
  );
}
