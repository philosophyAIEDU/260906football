import { Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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
      shadows={quality !== "low"}
      dpr={quality === "low" ? 1 : [1, quality === "high" ? 1.75 : 1.3]}
      camera={{ position: [36, 29, 43], fov: 43, near: 0.1, far: 280 }}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#a9cbdc"]} />
      <fog attach="fog" args={["#bdd1d7", 145, 260]} />
      <hemisphereLight args={["#e8f2ff", "#435b25", 1.35]} />
      <directionalLight
        position={[-26, 55, -32]}
        intensity={2.4}
        castShadow={quality !== "low"}
        shadow-mapSize={quality === "high" ? 4096 : 2048}
        shadow-camera-left={-72}
        shadow-camera-right={72}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-far={180}
        shadow-bias={-0.00012}
        shadow-normalBias={0.025}
        shadow-radius={2}
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
