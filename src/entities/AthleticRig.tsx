import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { match } from "../game/MatchEngine";
import {humanGeometry} from "./humanGeometry";
import { teams } from "../data/teams";
// Shared geometry keeps twenty-two articulated players inexpensive.
const sphere = new THREE.SphereGeometry(1, 20, 16);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);

const skinColors = ["#c69876", "#76503b", "#deb495", "#a97150"];
export function AthleticRig({
  index,
  uniform,
}: {
  index: number;
  uniform: THREE.Texture | null;
}) {
  const body = useRef<THREE.Group>(null),
    head = useRef<THREE.Group>(null);
  const hips = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const knees = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const shoulders = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const elbows = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const clock = useRef(index * 0.61);
  const p = match.players[index];
  const keeper = p.slot === 0;
  const kit = keeper
    ? p.teamId === 0
      ? "#f2c641"
      : "#35bfa6"
    : teams[p.teamId].color;
  const materials = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({
        color: skinColors[index % 4],
        roughness: 0.84,
      }),
      shirt: new THREE.MeshStandardMaterial({
        color: kit,
        map: uniform,
        roughness: 0.92,
      }),
      shorts: new THREE.MeshStandardMaterial({
        color: keeper ? kit : p.teamId === 0 ? "#f4f3e8" : "#142332",
        roughness: 0.92,
      }),
      socks: new THREE.MeshStandardMaterial({
        color: p.teamId === 0 ? "#f0f2e8" : kit,
        roughness: 0.95,
      }),
      trim: new THREE.MeshStandardMaterial({
        color: "#f6f4e9",
        roughness: 0.85,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: ["#241c16", "#38241a", "#17191b"][index % 3],
        roughness: 1,
      }),
      boots: new THREE.MeshStandardMaterial({
        color:
          index % 3 === 0 ? "#f0d847" : index % 3 === 1 ? "#eaece8" : "#ef7550",
        roughness: 0.48,
      }),
      sole: new THREE.MeshStandardMaterial({
        color: "#202a2e",
        roughness: 0.65,
      }),
    }),
    [index, kit, keeper, p.teamId, uniform],
  );
  const number = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = kit;
    ctx.fillRect(0, 0, 256, 256);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px Arial";
    ctx.fillText(p.name.split(" ").pop()!.toUpperCase(), 128, 48);
    ctx.font = "bold 150px Arial";
    ctx.fillText(String(p.shirtNumber), 128, 205);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kit, p.name, p.shirtNumber]);
  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
    },
    [materials],
  );
  useEffect(()=>()=>number.dispose(),[number]);
  useFrame((_, dt) => {
    const player = match.players[index];
    if (!body.current) return;
    const active = !["paused", "halftime", "finished", "menu"].includes(
      match.phase,
    );
    if (!active) return;
    const speed = Math.hypot(player.vel.x, player.vel.z),
      run = Math.min(1, speed / 5.5);
    clock.current += dt * speed * 2.4;
    const phase = clock.current;
    const action = player.actionTime > 0;
    const kick =
      action &&
      [
        "Pass",
        "ThroughPass",
        "Cross",
        "Shoot",
        "CurledShot",
        "GoalkeeperKick",
      ].includes(player.animation);
    const slide = action && player.animation === "SlideTackle";
    const celebrate = player.animation === "Celebrate";
    const jump =
      action && player.animation === "Header"
        ? Math.sin(Math.min(1, (0.55 - player.actionTime) / 0.55) * Math.PI) *
          0.45
        : 0;
    body.current.position.y =
      Math.abs(Math.sin(phase)) * run * 0.035 + jump - (slide ? 0.52 : 0);
    body.current.rotation.x = slide ? -1.03 : run * 0.12;
    body.current.rotation.z =
      player.dive > 0
        ? (player.animation === "GoalkeeperDiveLeft" ? 1 : -1) * 1.18
        : Math.sin(phase) * run * 0.025;
    if (head.current) head.current.rotation.x = -run * 0.12;
    for (let i = 0; i < 2; i++) {
      const wave = phase + i * Math.PI;
      const stride = Math.sin(wave);
      const blend=1-Math.exp(-dt*14);
      if (hips[i].current)
        hips[i].current!.rotation.x = THREE.MathUtils.lerp(hips[i].current!.rotation.x,
          kick && i === 1
            ? -0.95
            : slide
              ? i === 0
                ? -0.9
                : 0.35
              : stride * run * 0.65,blend);
      if (knees[i].current)
        knees[i].current!.rotation.x = THREE.MathUtils.lerp(knees[i].current!.rotation.x,
          kick && i === 1
            ? 0.18
            : Math.max(0, -Math.cos(wave)) * run * 1.1 + 0.045,blend);
      if (shoulders[i].current) {
        shoulders[i].current!.rotation.x = -stride * run * 0.6;
        shoulders[i].current!.rotation.z = celebrate
          ? i === 0
            ? 2.5
            : -2.5
          : player.dive > 0
            ? i === 0
              ? 1.65
              : -1.65
            : i === 0
              ? 0.12
              : -0.12;
      }
      if (elbows[i].current)
        elbows[i].current!.rotation.x = -(
          0.22 +
          run * 0.8 +
          Math.cos(wave) * run * 0.15
        );
    }
  });
  return (
    <group ref={body} dispose={null}>
      <group position={[0, 1.24, 0]}>
        <mesh
          castShadow
          geometry={humanGeometry.torso}
          material={materials.shirt}
          scale={[0.185, 0.48, 0.105]}
        />
        <mesh
          geometry={sphere}
          material={materials.trim}
          position={[0, 0.285, 0.007]}
          scale={[0.09, 0.021, 0.072]}
        />
        <mesh
          geometry={sphere}
          material={materials.skin}
          position={[0, 0.325, 0.005]}
          scale={[0.055, 0.08, 0.055]}
        />
        {p.teamId === 0 ? (
          [-0.11, 0.11].map((x) => (
            <mesh key={x} position={[x, 0.015, 0.107]}>
              <planeGeometry args={[0.045, 0.38]} />
              <meshStandardMaterial color="#e9f2ff" roughness={0.92} />
            </mesh>
          ))
        ) : (
          <mesh position={[0, 0.1, 0.107]}>
            <planeGeometry args={[0.37, 0.075]} />
            <meshStandardMaterial color="#f0e9dd" roughness={0.9} />
          </mesh>
        )}
        <mesh position={[0.105, 0.145, 0.108]}>
          <circleGeometry args={[0.026, 5]} />
          <meshStandardMaterial color="#f4d47c" />
        </mesh>
        <mesh position={[0, 0.035, -0.108]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.31, 0.35]} />
          <meshStandardMaterial map={number} roughness={0.9} />
        </mesh>
      </group>
      <mesh
        castShadow
        geometry={humanGeometry.pelvis}
        material={materials.shorts}
        position={[0, 0.963, 0]}
        scale={[0.17, 0.105, 0.112]}
      />
      <group ref={head} position={[0, 1.695, 0.005]}>
        <mesh
          castShadow
          geometry={humanGeometry.head}
          material={materials.skin}
          scale={[0.092, 0.125, 0.095]}
        />
        <mesh
          castShadow
          geometry={humanGeometry.hair}
          material={materials.hair}
          position={[0, 0.075, -0.014]}
          scale={[0.095, 0.056, 0.094]}
        />
        <mesh
          geometry={sphere}
          material={materials.skin}
          position={[0, -0.007, 0.105]}
          scale={[0.023, 0.033, 0.035]}
        />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh
              geometry={sphere}
              material={materials.skin}
              position={[s * 0.11, 0, 0]}
              scale={[0.021, 0.04, 0.025]}
            />
            <mesh
              geometry={sphere}
              material={materials.hair}
              position={[s * 0.04, 0.025, 0.097]}
              scale={[0.012, 0.007, 0.006]}
            />
          </group>
        ))}
      </group>
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <group ref={hips[i]} position={[side * 0.105, 0.955, 0]}>
            <mesh
              castShadow
              geometry={cylinder}
              material={materials.shorts}
              position={[0, -0.075, 0]}
              scale={[0.086, 0.22, 0.091]}
            />
            <mesh
              castShadow
              geometry={humanGeometry.thigh}
              material={materials.skin}
              position={[0, -0.27, 0]}
              scale={[0.066, 0.23, 0.07]}
            />
            <group ref={knees[i]} position={[0, -0.435, 0]}>
              <mesh
                castShadow
                geometry={sphere}
                material={materials.skin}
                scale={[0.054, 0.057, 0.056]}
              />
              <mesh
                castShadow
                geometry={humanGeometry.calf}
                material={materials.socks}
                position={[0, -0.22, 0]}
                scale={[0.048, 0.235, 0.054]}
              />
              <mesh
                geometry={cylinder}
                material={materials.trim}
                position={[0, -0.07, 0]}
                scale={[0.063, 0.026, 0.067]}
              />
              <mesh
                castShadow
                geometry={humanGeometry.shoe}
                material={materials.boots}
                position={[0, -0.456, 0.07]}
                scale={[0.073, 0.058, 0.145]}
              />
              <mesh
                geometry={humanGeometry.shoe}
                material={materials.sole}
                position={[0, -0.491, 0.073]}
                scale={[0.073, 0.018, 0.142]}
              />
            </group>
          </group>
          <group ref={shoulders[i]} position={[side * 0.204, 1.425, 0]}>
            <mesh
              castShadow
              geometry={humanGeometry.sleeve}
              material={materials.shirt}
              position={[side * 0.025, -0.065, 0]}
              scale={[0.067, 0.11, 0.068]}
            />
            <mesh
              castShadow
              geometry={humanGeometry.upperArm}
              material={materials.skin}
              position={[side * 0.027, -0.18, 0]}
              scale={[0.057, 0.15, 0.06]}
            />
            <group ref={elbows[i]} position={[side * 0.027, -0.3, 0]}>
              <mesh
                castShadow
                geometry={humanGeometry.forearm}
                material={materials.skin}
                position={[0, -0.12, 0]}
                scale={[0.045, 0.142, 0.047]}
              />
              <mesh
                castShadow
                geometry={humanGeometry.hand}
                material={keeper ? materials.trim : materials.skin}
                position={[0, -0.265, 0.006]}
                scale={[0.047, 0.073, 0.033]}
              />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
