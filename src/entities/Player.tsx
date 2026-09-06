import {
  Component,
  Suspense,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CapsuleCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import type { Player as PlayerData } from "../game/types";
import { match } from "../game/MatchEngine";
import { AnimatedModel } from "./AnimatedModel";
import { AthleticRig } from "./AthleticRig";
import { assetConfig } from "../data/assets";
class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function Player({ player: p }: { player: PlayerData }) {
  const [uniform, setUniform] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const url = assetConfig.uniformTextures[p.teamId];
    if (!url) return;
    let alive = true;
    let loaded: THREE.Texture | undefined;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        loaded = t;
        t.colorSpace = THREE.SRGBColorSpace;
        if (alive) setUniform(t);
        else t.dispose();
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [p.teamId]);
  const root = useRef<THREE.Group>(null),
    rig = useRef<RapierRigidBody>(null),
    marker = useRef<THREE.Group>(null),
    energy = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const current = match.players[p.index];
    if (!root.current || !rig.current) return;
    root.current.visible = !current.red;
    rig.current.setEnabled(!current.red);
    if (current.red) return;
    root.current.position.set(current.pos.x, 0, current.pos.z);
    root.current.rotation.y = current.angle;
    rig.current.setNextKinematicTranslation({
      x: current.pos.x,
      y: 0.87,
      z: current.pos.z,
    });
    if (marker.current) {
      marker.current.visible =
        current.index === match.selected && match.phase !== "menu";
      marker.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.035;
    }
    if (energy.current) {
      energy.current.scale.x = current.energy / 100;
      energy.current.position.x = -(1 - current.energy / 100) * 0.35;
    }
  });
  const fallback = (
    <group scale={1.04}>
      <AthleticRig index={p.index} uniform={uniform} />
    </group>
  );
  return (
    <>
      <RigidBody
        ref={rig}
        type="kinematicPosition"
        colliders={false}
        position={[p.pos.x, 0.87, p.pos.z]}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider args={[0.5, 0.3]} friction={0.2} restitution={0.08} />
      </RigidBody>
      <group ref={root}>
        {assetConfig.playerModel ? (
          <ModelBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <AnimatedModel url={assetConfig.playerModel} index={p.index} />
            </Suspense>
          </ModelBoundary>
        ) : (
          fallback
        )}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.021, 0]}
          scale={[0.48, 0.34, 1]}
        >
          <circleGeometry args={[1, 20]} />
          <meshBasicMaterial
            color="#112410"
            transparent
            opacity={0.19}
            depthWrite={false}
          />
        </mesh>
        <group ref={marker}>
          <mesh position={[0, 2.16, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.14, 0.25, 3]} />
            <meshBasicMaterial color="#62faaa" toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.033, 0]}>
            <ringGeometry args={[0.37, 0.41, 40]} />
            <meshBasicMaterial
              color="#5cf09a"
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </mesh>
          <group position={[0, 0.06, -0.52]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <planeGeometry args={[0.75, 0.09]} />
              <meshBasicMaterial color="#17381d" transparent opacity={0.8} />
            </mesh>
            <mesh ref={energy} position={[0, 0, 0.002]}>
              <planeGeometry args={[0.7, 0.06]} />
              <meshBasicMaterial color="#59f393" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  );
}
