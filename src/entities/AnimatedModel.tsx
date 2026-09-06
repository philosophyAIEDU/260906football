import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { assetConfig } from "../data/assets";
import { match } from "../game/MatchEngine";
/** Optional rig adapter. The source model must face +Z with feet at Y=0, at meter scale. */
export function AnimatedModel({ url, index }: { url: string; index: number }) {
  const gltf = useGLTF(url);
  const model = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const previous = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    };
  }, [model, mixer]);
  useFrame((_, dt) => {
    const p = match.players[index];
    if (["paused", "halftime", "finished", "menu"].includes(match.phase))
      return;
    const name =
      assetConfig.animationMap[p.animation] ??
      assetConfig.animationMap[
        Math.hypot(p.vel.x, p.vel.z) > 1 ? "Run" : "Idle"
      ];
    const clip =
      gltf.animations.find((a) => a.name === name) ?? gltf.animations[0];
    if (clip) {
      const action = mixer.clipAction(clip);
      if (action !== previous.current) {
        previous.current?.fadeOut(0.18);
        action.reset().fadeIn(0.18).play();
        action.time = index * 0.017;
        previous.current = action;
      }
      action.timeScale =
        p.actionTime > 0 ? 1 : Math.max(0.7, Math.hypot(p.vel.x, p.vel.z) / 4);
    }
    mixer.update(Math.min(dt, 0.06));
  });
  return (
    <primitive
      object={model}
      scale={assetConfig.modelScale}
      rotation={[0, assetConfig.modelRotation, 0]}
      dispose={null}
    />
  );
}
