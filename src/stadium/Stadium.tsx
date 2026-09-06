import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { match } from "../game/MatchEngine";
import { useMatch } from "../store/matchStore";
import { useSettings } from "../store/settingsStore";
function Board({
  position,
  rotation = 0,
  text,
  width = 18,
}: {
  position: [number, number, number];
  rotation?: number;
  text: string;
  width?: number;
}) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#122a31";
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = "#d3f76d";
    ctx.font = "bold 52px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 512, 83);
    return new THREE.CanvasTexture(c);
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <boxGeometry args={[width, 1.3, 0.16]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}
function Crowd() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const quality = useSettings((s) => s.settings.quality);
  const count = quality === "low" ? 360 : quality === "medium" ? 1200 : 2200;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const people = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const side = i % 2 ? 1 : -1,
          row = Math.floor(i / 180) % 6;
        return {
          x: -58 + ((i * 1.618) % 116),
          y: 2.5 + row * 0.9,
          z: side * (41 + row * 1.2),
          seed: i * 0.7,
        };
      }),
    [count],
  );
  useEffect(() => {
    if (!ref.current) return;
    const color = new THREE.Color();
    people.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(0.42, 0.85, 0.4);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      color.set(["#e6dbca", "#1948a5", "#c5374c", "#303b4f", "#98aac1"][i % 5]);
      ref.current!.setColorAt(i, color);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [people, dummy]);
  useFrame(({ clock }) => {
    if (!ref.current || match.phase !== "goal") return;
    people.forEach((p, i) => {
      dummy.position.set(
        p.x,
        p.y + Math.max(0, Math.sin(clock.elapsedTime * 6 + p.seed)) * 0.4,
        p.z,
      );
      dummy.scale.set(0.42, 0.85, 0.4);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <capsuleGeometry args={[0.45, 0.6, 2, 5]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}
export function Stadium() {
  const score = useMatch((s) => s.score);
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          {Array.from({ length: 7 }, (_, r) => (
            <mesh
              key={r}
              position={[0, 1 + r * 0.45, s * (41 + r * 1.2)]}
              receiveShadow
            >
              <boxGeometry args={[124, 2 + r * 0.9, 1.25]} />
              <meshStandardMaterial
                color={r % 2 ? "#6e8291" : "#607786"}
                roughness={0.9}
              />
            </mesh>
          ))}
          <mesh position={[0, 9.5, s * 50]} rotation={[s * 0.12, 0, 0]}>
            <boxGeometry args={[128, 0.35, 8]} />
            <meshStandardMaterial
              color="#e3e8e7"
              metalness={0.2}
              roughness={0.6}
            />
          </mesh>
          {[-50, -25, 0, 25, 50].map((x, i) => (
            <Board
              key={x}
              position={[x, 0.8, s * 37]}
              rotation={s === 1 ? Math.PI : 0}
              text={
                [
                  "TOUCHLINE ELEVEN",
                  "PLAY THE BEAUTIFUL GAME",
                  "ROYAL BLUE FC",
                  "CRIMSON UNITED",
                  "ELEVEN. ONE TEAM.",
                ][i]
              }
            />
          ))}
        </group>
      ))}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}${z}`} position={[x * 60, 0, z * 39]}>
            <mesh position={[0, 11, 0]}>
              <cylinderGeometry args={[0.17, 0.27, 22, 8]} />
              <meshStandardMaterial color="#c7d3d7" />
            </mesh>
            <mesh position={[0, 22, 0]} rotation={[z * -0.25, 0, 0]}>
              <boxGeometry args={[5, 1.8, 0.4]} />
              <meshStandardMaterial
                color="#f5f7df"
                emissive="#ffffdd"
                emissiveIntensity={0.3}
              />
            </mesh>
          </group>
        )),
      )}
      <Board
        position={[57, 8, 0]}
        rotation={-Math.PI / 2}
        text={`ROY ${score[0]} : ${score[1]} CRU`}
        width={17}
      />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 17, 0, 39]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[10, 0.15, 2.7]} />
            <meshStandardMaterial color="#b8d2e1" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[9, 0.7, 1]} />
            <meshStandardMaterial color={s < 0 ? "#2364c3" : "#c9364e"} />
          </mesh>
        </group>
      ))}
      <Crowd />
    </group>
  );
}
