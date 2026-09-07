import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { match } from "../game/MatchEngine";
import { playerGeometry, createSkeleton } from "./playerBody";
import { createKitTexture, kitSurfaces } from "./kitTexture";
import { createRigState, poseRig } from "./playerAnimator";
const frozen = ["paused", "halftime", "finished", "menu"];
/** One skinned footballer: shared geometry, own skeleton, own painted kit. */
export function PlayerRig({ index }: { index: number }) {
  const player = match.players[index];
  const group = useRef<THREE.Group>(null);
  const state = useRef(createRigState(index));
  const rig = useMemo(() => {
    const { texture, variant } = createKitTexture(player);
    const relief = kitSurfaces(player.slot === 0);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      normalMap: relief.normal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: relief.roughness,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.7,
    });
    const { bones, skeleton } = createSkeleton();
    const mesh = new THREE.SkinnedMesh(playerGeometry(), material);
    mesh.add(bones.hips);
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh, bones, material, texture, variant };
  }, [player]);
  useEffect(
    () => () => {
      rig.material.dispose();
      rig.texture.dispose();
      rig.mesh.skeleton.dispose();
    },
    [rig],
  );
  useFrame((_, dt) => {
    if (!group.current || frozen.includes(match.phase)) return;
    const pose = poseRig(
      rig.bones,
      match.players[index],
      Math.min(dt, 0.05),
      state.current,
    );
    group.current.position.y = pose.bob;
    group.current.rotation.x = pose.pitch;
    group.current.rotation.z = pose.roll;
  });
  return (
    <group
      ref={group}
      scale={[rig.variant.build, rig.variant.height, rig.variant.build]}
    >
      <primitive object={rig.mesh} />
    </group>
  );
}
