import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  CuboidCollider,
  useBeforePhysicsStep,
} from "@react-three/rapier";
import { Pitch } from "../stadium/Pitch";
import { Goals } from "../stadium/Goals";
import { Stadium } from "../stadium/Stadium";
import { Player } from "../entities/Player";
import { Ball } from "../entities/Ball";
import { CameraSystem } from "../systems/CameraSystem";
import { match } from "./MatchEngine";
import { input } from "../systems/InputSystem";
import { useSettings } from "../store/settingsStore";
import { useMatch } from "../store/matchStore";
import { skyTexture } from "../stadium/textures";
/**
 * Image based lighting from the sky gradient. It costs one small render at
 * start-up and gives kits, the ball and the roof steel a believable sheen.
 */
function SkyLight() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const source = skyTexture().clone();
    source.needsUpdate = true;
    source.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromEquirectangular(source);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.5;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      source.dispose();
    };
  }, [gl, scene]);
  return null;
}
function Loop() {
  useEffect(() => input.attach(), []);
  useBeforePhysicsStep(() => match.tick(1 / 60, input.sample()));
  useFrame((_, dt) => {
    match.fps += (Math.min(120, 1 / Math.max(dt, 0.001)) - match.fps) * 0.03;
  });
  useEffect(() => {
    const hide = () => {
      if (
        document.hidden &&
        ["playing", "setPiece", "kickoff", "goal", "preMatch"].includes(
          match.phase,
        )
      )
        match.pause();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  return null;
}
function PauseInput() {
  const phase = useMatch((s) => s.phase);
  useFrame(() => {
    if (
      phase === "paused" ||
      phase === "halftime" ||
      phase === "finished" ||
      phase === "menu"
    ) {
      const frame = input.sample();
      if (frame.actions.some((a) => a.key === "Escape")) match.pause();
    }
  });
  return null;
}
export function GameCanvas() {
  const quality = useSettings((s) => s.settings.quality);
  const phase = useMatch((s) => s.phase);
  const paused = ["menu", "paused", "halftime", "finished"].includes(phase);
  return (
    <Canvas
      shadows={quality === "low" ? false : { type: THREE.PCFSoftShadowMap }}
      dpr={quality === "low" ? 1 : [1, quality === "high" ? 1.9 : 1.4]}
      camera={{ position: [36, 29, 43], fov: 43, near: 0.3, far: 900 }}
      gl={{
        antialias: quality !== "low",
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <color attach="background" args={["#9fc3d8"]} />
      <fog attach="fog" args={["#b6cdd8", 175, 460]} />
      <SkyLight />
      <hemisphereLight args={["#dff0ff", "#3d5a26", 0.9]} />
      <directionalLight
        position={[-58, 86, -44]}
        intensity={2.35}
        color="#fff3df"
        castShadow={quality !== "low"}
        shadow-mapSize={quality === "high" ? 4096 : 2048}
        shadow-camera-left={-78}
        shadow-camera-right={78}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
        shadow-camera-near={20}
        shadow-camera-far={240}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
      />
      <directionalLight
        position={[62, 44, 58]}
        intensity={0.45}
        color="#cfe2ff"
      />
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} paused={paused}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[75, 0.2, 55]}
              position={[0, -0.22, 0]}
              friction={0.7}
              restitution={0.15}
            />
          </RigidBody>
          <Pitch />
          <Goals />
          <Stadium />
          {match.players.map((p) => (
            <Player key={p.id} player={p} />
          ))}
          <Ball />
          <Loop />
        </Physics>
      </Suspense>
      <CameraSystem />
      <PauseInput />
    </Canvas>
  );
}
