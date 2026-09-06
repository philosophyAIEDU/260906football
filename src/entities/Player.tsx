import {
  Component,
  Suspense,
  useEffect,
  useState,
  useMemo,
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
const skin = ["#bc8d6d", "#845f49", "#e0ad86", "#ad775b"];
function Limb({ arm = false, side = 1 }: { arm?: boolean; side?: number }) {
  return (
    <group>
      <mesh castShadow position={[0, arm ? -0.19 : -0.23, 0]}>
        <capsuleGeometry
          args={[arm ? 0.075 : 0.105, arm ? 0.24 : 0.28, 3, 7]}
        />
        <meshStandardMaterial
          color={arm ? "#be987e" : "#f0f2ee"}
          roughness={0.9}
        />
      </mesh>
      {!arm && (
        <mesh castShadow position={[0, -0.5, 0.08]}>
          <boxGeometry args={[0.18, 0.13, 0.33]} />
          <meshStandardMaterial color={side > 0 ? "#f0e568" : "#15222a"} />
        </mesh>
      )}
    </group>
  );
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
    left = useRef<THREE.Group>(null),
    right = useRef<THREE.Group>(null),
    armL = useRef<THREE.Group>(null),
    armR = useRef<THREE.Group>(null),
    marker = useRef<THREE.Mesh>(null),
    torso = useRef<THREE.Group>(null);
  const color =
    p.slot === 0
      ? p.teamId === 0
        ? "#f5c934"
        : "#59d6bd"
      : teams[p.teamId].color;
  const numberTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 88px Arial";
    ctx.fillText(String(p.shirtNumber), 64, 97);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [p.shirtNumber, color]);
  useFrame(({ clock }) => {
    if (!root.current || !rig.current) return;
    const current = match.players[p.index];
    root.current.visible = !current.red;
    if (current.red) {
      rig.current.setEnabled(false);
      return;
    }
    rig.current.setEnabled(true);
    root.current.position.set(current.pos.x, 0, current.pos.z);
    root.current.rotation.y = current.angle;
    rig.current.setNextKinematicTranslation({
      x: current.pos.x,
      y: 0.87,
      z: current.pos.z,
    });
    if (marker.current)
      marker.current.visible =
        current.index === match.selected && match.phase !== "menu";
    const moving = !["paused", "halftime", "finished", "menu"].includes(
      match.phase,
    );
    const speed = moving ? Math.hypot(current.vel.x, current.vel.z) : 0;
    const wave =
      Math.sin(clock.elapsedTime * (5 + speed * 1.4) + current.index * 1.3) *
      Math.min(0.8, speed * 0.13);
    const action = current.actionTime > 0;
    const kick =
      action &&
      [
        "Pass",
        "ThroughPass",
        "Cross",
        "Shoot",
        "CurledShot",
        "GoalkeeperKick",
      ].includes(current.animation);
    if (left.current) left.current.rotation.x = wave;
    if (right.current) right.current.rotation.x = kick ? -1.2 : -wave;
    if (armL.current) {
      armL.current.rotation.x = -wave * 0.6;
      armL.current.rotation.z = current.animation === "Celebrate" ? 1.9 : 0.15;
    }
    if (armR.current) {
      armR.current.rotation.x = wave * 0.6;
      armR.current.rotation.z =
        current.animation === "Celebrate" ? -1.9 : -0.15;
    }
    if (torso.current) {
      torso.current.position.y =
        current.animation === "Header" && action
          ? Math.sin(((0.55 - current.actionTime) / 0.55) * Math.PI) * 0.55
          : Math.abs(wave) * 0.035;
      torso.current.rotation.z =
        current.dive > 0
          ? (current.animation === "GoalkeeperDiveLeft" ? 1 : -1) * 1.05
          : 0;
      torso.current.rotation.x =
        current.animation === "SlideTackle" && action
          ? -1.15
          : Math.min(0.15, speed * 0.016);
    }
  });
  const procedural = (
    <group ref={torso}>
      <mesh castShadow position={[0, 1.15, 0]}>
        <capsuleGeometry args={[0.25, 0.38, 4, 9]} />
        <meshStandardMaterial color={color} map={uniform} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.2, 0.245]}>
        <boxGeometry
          args={p.teamId === 0 ? [0.08, 0.52, 0.012] : [0.46, 0.1, 0.012]}
        />
        <meshStandardMaterial color="#e9effb" />
      </mesh>
      <mesh position={[0, 1.22, -0.254]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.33, 0.4]} />
        <meshStandardMaterial map={numberTexture} />
      </mesh>
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[0.43, 0.28, 0.29]} />
        <meshStandardMaterial
          color={p.slot === 0 ? color : p.teamId === 0 ? "#f4f5eb" : "#192330"}
        />
      </mesh>
      <mesh castShadow position={[0, 1.66, 0.025]}>
        <sphereGeometry args={[0.19, 10, 8]} />
        <meshStandardMaterial color={skin[p.index % 4]} roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 1.77, 0.005]}>
        <sphereGeometry args={[0.174, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#302721" />
      </mesh>
      <mesh position={[0, 1.66, 0.2]}>
        <sphereGeometry args={[0.045, 5, 4]} />
        <meshStandardMaterial color={skin[p.index % 4]} />
      </mesh>
      <group ref={left} position={[-0.13, 0.69, 0]}>
        <Limb side={-1} />
      </group>
      <group ref={right} position={[0.13, 0.69, 0]}>
        <Limb />
      </group>
      <group ref={armL} position={[-0.32, 1.37, 0]}>
        <Limb arm />
      </group>
      <group ref={armR} position={[0.32, 1.37, 0]}>
        <Limb arm />
      </group>
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
          <ModelBoundary fallback={procedural}>
            <Suspense fallback={procedural}>
              <AnimatedModel url={assetConfig.playerModel} index={p.index} />
            </Suspense>
          </ModelBoundary>
        ) : (
          procedural
        )}
        <mesh
          ref={marker}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.06, 0]}
        >
          <ringGeometry args={[0.65, 0.77, 32]} />
          <meshBasicMaterial color="#d9fc73" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </>
  );
}
