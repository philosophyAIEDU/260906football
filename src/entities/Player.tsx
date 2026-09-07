import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
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
import { PlayerRig } from "./PlayerRig";
import { loadKitOverlays } from "./kitTexture";
import { softCircle } from "../stadium/textures";
import { assetConfig } from "../data/assets";
import { teams } from "../data/teams";
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
  // Shirt artwork, when a project supplies it, arrives after the first paint.
  const [kitRevision, setKitRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    loadKitOverlays().then(() => alive && setKitRevision((n) => n + 1));
    return () => {
      alive = false;
    };
  }, []);
  const root = useRef<THREE.Group>(null),
    rig = useRef<RapierRigidBody>(null),
    marker = useRef<THREE.Group>(null),
    chevron = useRef<THREE.Mesh>(null),
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
      const pulse = Math.sin(clock.elapsedTime * 3.4);
      if (chevron.current) chevron.current.position.y = 2.24 + pulse * 0.055;
      marker.current.scale.setScalar(1 + pulse * 0.03);
    }
    if (energy.current) {
      energy.current.scale.x = Math.max(0.02, current.energy / 100);
      energy.current.position.x = -(1 - current.energy / 100) * 0.35;
    }
  });
  const fallback = <PlayerRig key={kitRevision} index={p.index} />;
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
          position={[0, 0.016, 0.04]}
          scale={[0.78, 0.62, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={softCircle()}
            color="#0d1c0b"
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
        <group ref={marker}>
          <mesh
            ref={chevron}
            position={[0, 2.24, 0]}
            rotation={[0, Math.PI / 4, Math.PI]}
          >
            <coneGeometry args={[0.13, 0.26, 4]} />
            <meshBasicMaterial
              color={teams[p.teamId].color}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
            <ringGeometry args={[0.34, 0.44, 48]} />
            <meshBasicMaterial
              color="#8dffbe"
              transparent
              opacity={0.55}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}>
            <circleGeometry args={[0.46, 32]} />
            <meshBasicMaterial
              map={softCircle()}
              color="#4bf49a"
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
          <group position={[0, 0.055, -0.56]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <planeGeometry args={[0.76, 0.1]} />
              <meshBasicMaterial color="#0d2415" transparent opacity={0.72} />
            </mesh>
            <mesh ref={energy} position={[0, 0, 0.002]}>
              <planeGeometry args={[0.7, 0.058]} />
              <meshBasicMaterial color="#6ef7a4" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  );
}
