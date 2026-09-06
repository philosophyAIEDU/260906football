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
      camera={{ position: [62, 51, 68], fov: 49, near: 0.1, far: 280 }}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#a9c5d4"]} />
      <fog attach="fog" args={["#b9cfdb", 115, 245]} />
      <hemisphereLight args={["#e2efff", "#667950", 2.1]} />
      <directionalLight
        position={[-35, 65, 30]}
        intensity={2.8}
        castShadow={quality !== "low"}
        shadow-mapSize={quality === "high" ? 2048 : 1024}
        shadow-camera-left={-72}
        shadow-camera-right={72}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-far={180}
        shadow-bias={-0.0003}
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
