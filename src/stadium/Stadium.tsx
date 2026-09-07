import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { match } from "../game/MatchEngine";
import { useMatch } from "../store/matchStore";
import { useSettings } from "../store/settingsStore";
import { teams } from "../data/teams";
import { boardTexture, seatTexture, skyTexture } from "./textures";
/** Stand layout, in metres from the centre spot. */
const SIDE = { inner: 40, rows: 16, tread: 1.05, rise: 0.62, length: 120 };
const END = { inner: 62, rows: 14, tread: 1.05, rise: 0.62, length: 84 };
type Deck = typeof SIDE;
const deckDepth = (d: Deck) => d.rows * d.tread;
const deckHeight = (d: Deck) => d.rows * d.rise;
/** Stepped seating deck: treads carry seats, risers carry concrete. */
function stairs(deck: Deck, part: "tread" | "riser") {
  const position: number[] = [];
  const uv: number[] = [];
  const half = deck.length / 2;
  const quad = (
    z0: number,
    y0: number,
    z1: number,
    y1: number,
    v0: number,
    v1: number,
  ) => {
    const u = deck.length / 4;
    position.push(
      -half, y0, z0, half, y0, z0, half, y1, z1,
      -half, y0, z0, half, y1, z1, -half, y1, z1,
    );
    uv.push(0, v0, u, v0, u, v1, 0, v0, u, v1, 0, v1);
  };
  for (let i = 0; i < deck.rows; i++) {
    const z = deck.inner + i * deck.tread;
    const y = 1.1 + i * deck.rise;
    if (part === "riser") quad(z, y - deck.rise, z, y, 0, 0.5);
    else quad(z, y, z + deck.tread, y, i * 0.5, i * 0.5 + 0.5);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(position, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}
function Stand({
  deck,
  rotation,
  seats,
}: {
  deck: Deck;
  rotation: number;
  seats: [string, string];
}) {
  const parts = useMemo(
    () => ({ tread: stairs(deck, "tread"), riser: stairs(deck, "riser") }),
    [deck],
  );
  useEffect(
    () => () => {
      parts.tread.dispose();
      parts.riser.dispose();
    },
    [parts],
  );
  const depth = deckDepth(deck);
  const height = deckHeight(deck);
  const seatMap = useMemo(() => {
    const map = seatTexture(seats[0], seats[1]).clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    return map;
  }, [seats]);
  useEffect(() => () => seatMap.dispose(), [seatMap]);
  return (
    <group rotation={[0, rotation, 0]}>
      <mesh geometry={parts.tread} receiveShadow>
        <meshStandardMaterial map={seatMap} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.riser} receiveShadow>
        <meshStandardMaterial color="#8d979d" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Perimeter wall in front of the first row. */}
      <mesh position={[0, 0.55, deck.inner - 0.1]} receiveShadow castShadow>
        <boxGeometry args={[deck.length, 1.1, 0.5]} />
        <meshStandardMaterial color="#4a575e" roughness={0.9} />
      </mesh>
      {/* Roof slab and its supporting trusses. */}
      <mesh
        position={[0, height + 6.4, deck.inner + depth * 0.52]}
        rotation={[-0.08, 0, 0]}
        castShadow
      >
        <boxGeometry args={[deck.length + 4, 0.5, depth + 7]} />
        <meshStandardMaterial color="#cfd8da" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh
        position={[0, height + 6.05, deck.inner + depth * 0.52]}
        rotation={[-0.08, 0, 0]}
      >
        <boxGeometry args={[deck.length + 3.4, 0.16, depth + 6]} />
        <meshStandardMaterial
          color="#f2f6f4"
          emissive="#dfeaf2"
          emissiveIntensity={0.28}
          roughness={0.8}
        />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh
          key={i}
          position={[
            -deck.length / 2 + (i * deck.length) / 8,
            height / 2 + 3.6,
            deck.inner + depth + 1.6,
          ]}
          castShadow
        >
          <boxGeometry args={[0.5, height + 7, 0.5]} />
          <meshStandardMaterial color="#b6c2c6" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
/** Instanced spectators, seated on the decks and up on their feet for a goal. */
function Crowd() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const quality = useSettings((s) => s.settings.quality);
  const fill = quality === "low" ? 0.3 : quality === "medium" ? 0.62 : 0.88;
  const geometry = useMemo(() => {
    const body = new THREE.CapsuleGeometry(0.15, 0.42, 2, 6);
    body.translate(0, 0.31, 0);
    const head = new THREE.SphereGeometry(0.098, 6, 4);
    head.translate(0, 0.64, 0);
    const merged = mergeGeometries([body, head])!;
    body.dispose();
    head.dispose();
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const people = useMemo(() => {
    const list: { x: number; y: number; z: number; seed: number; tone: number }[] = [];
    const decks: [Deck, number][] = [
      [SIDE, 0],
      [SIDE, Math.PI],
      [END, Math.PI / 2],
      [END, -Math.PI / 2],
    ];
    let seed = 20260906;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    decks.forEach(([deck, rotation], d) => {
      const cos = Math.cos(rotation),
        sin = Math.sin(rotation);
      const columns = Math.floor(deck.length / 0.52);
      const pitchX = deck.length / columns;
      for (let row = 0; row < deck.rows; row++)
        for (let column = 0; column < columns; column++) {
          if (random() > fill) continue;
          const lx = -deck.length / 2 + (column + 0.5) * pitchX;
          const lz = deck.inner + row * deck.tread + 0.58;
          list.push({
            x: lx * cos + lz * sin,
            y: 1.1 + row * deck.rise,
            z: -lx * sin + lz * cos,
            seed: random() * 6.28,
            // Ends are partisan, the sides are mixed.
            tone:
              d < 2 ? random() : d === 2 ? 0.82 + random() * 0.18 : random() * 0.18,
          });
        }
    });
    return list;
  }, [fill]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (!ref.current) return;
    const color = new THREE.Color();
    const neutral = ["#e6dbca", "#33404f", "#98aac1", "#5d6b74", "#c8cdd2"];
    people.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, Math.atan2(-p.x, -p.z), 0);
      dummy.scale.setScalar(0.94 + (p.seed % 1) * 0.16);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      if (p.tone > 0.8) color.set(teams[0].color).lerp(new THREE.Color("#dbe6ff"), (p.tone - 0.8) * 2);
      else if (p.tone < 0.2) color.set(teams[1].color).lerp(new THREE.Color("#ffe2e2"), p.tone * 2);
      else color.set(neutral[i % neutral.length]);
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
        p.y + Math.max(0, Math.sin(clock.elapsedTime * 6.5 + p.seed)) * 0.42,
        p.z,
      );
      dummy.rotation.set(0, Math.atan2(-p.x, -p.z), 0);
      dummy.scale.setScalar(0.94 + (p.seed % 1) * 0.16);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, people.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}
function Boards() {
  const copy: [string, string][] = [
    ["TOUCHLINE ELEVEN", "#d3f76d"],
    ["PLAY THE BEAUTIFUL GAME", "#7fd6ff"],
    ["ROYAL BLUE FC", "#5f9bff"],
    ["CRIMSON UNITED", "#ff7a86"],
    ["ELEVEN · ONE TEAM", "#ffd166"],
  ];
  const board = (
    key: string,
    position: [number, number, number],
    rotation: number,
    text: [string, string],
    width: number,
  ) => (
    <group key={key} position={position} rotation={[0, rotation, 0]}>
      <mesh rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[width, 1.05, 0.12]} />
        <meshStandardMaterial
          map={boardTexture(text[0], text[1])}
          emissiveMap={boardTexture(text[0], text[1])}
          emissive="#ffffff"
          emissiveIntensity={0.42}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
  return (
    <group>
      {[-1, 1].flatMap((s) =>
        [-2, -1, 0, 1, 2].map((i) =>
          board(
            `s${s}${i}`,
            [i * 21, 0.56, s * 37.2],
            s === 1 ? Math.PI : 0,
            copy[i + 2],
            20,
          ),
        ),
      )}
      {[-1, 1].flatMap((s) =>
        [-1, 0, 1].map((i) =>
          board(
            `e${s}${i}`,
            [s * 57.5, 0.56, i * 19],
            s === 1 ? -Math.PI / 2 : Math.PI / 2,
            copy[(i + 3) % 5],
            18,
          ),
        ),
      )}
    </group>
  );
}
/** End-stand screen showing the live score. */
function BigScreen({ side }: { side: number }) {
  const score = useMatch((s) => s.score);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d")!;
    ctx.fillStyle = "#070f16";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#16323f";
    ctx.fillRect(0, 0, 512, 54);
    ctx.textAlign = "center";
    ctx.fillStyle = "#d3f76d";
    ctx.font = "800 30px Barlow Condensed, Arial Narrow, Arial";
    ctx.fillText("TOUCHLINE ARENA", 256, 38);
    ctx.font = "800 96px Barlow Condensed, Arial Narrow, Arial";
    ctx.fillStyle = "#f4f9ff";
    ctx.fillText(`${score[0]} : ${score[1]}`, 256, 168);
    ctx.font = "700 30px Barlow Condensed, Arial Narrow, Arial";
    ctx.fillStyle = teams[0].color;
    ctx.fillText(teams[0].short, 96, 222);
    ctx.fillStyle = teams[1].color;
    ctx.fillText(teams[1].short, 416, 222);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [score, texture]);
  useEffect(() => () => texture.dispose(), [texture]);
  const x = side * (END.inner + deckDepth(END) + 3);
  return (
    <group position={[x, deckHeight(END) + 9.5, 0]} rotation={[0, side * -Math.PI / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[19, 10.4, 0.8]} />
        <meshStandardMaterial color="#141c24" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.45]}>
        <planeGeometry args={[17.6, 9]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -6.4, 0]}>
        <boxGeometry args={[2.2, 3.2, 2.2]} />
        <meshStandardMaterial color="#4c5a63" roughness={0.8} />
      </mesh>
    </group>
  );
}
function Floodlights() {
  return (
    <>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group
            key={`${x}${z}`}
            position={[x * 74, 0, z * 52]}
            rotation={[0, Math.atan2(-x, -z) * 0.5, 0]}
          >
            <mesh position={[0, 17, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.75, 34, 10]} />
              <meshStandardMaterial color="#aeb9bd" metalness={0.4} roughness={0.6} />
            </mesh>
            <group position={[0, 35, 0]} rotation={[z * 0.32, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[9, 5, 0.5]} />
                <meshStandardMaterial color="#2c363c" roughness={0.7} />
              </mesh>
              {Array.from({ length: 12 }, (_, i) => (
                <mesh
                  key={i}
                  position={[-3.6 + (i % 6) * 1.44, i < 6 ? 1.1 : -1.1, -0.32]}
                >
                  <boxGeometry args={[1.2, 1.7, 0.22]} />
                  <meshStandardMaterial
                    color="#fdfbe8"
                    emissive="#fff8d0"
                    emissiveIntensity={2.4}
                    toneMapped={false}
                  />
                </mesh>
              ))}
            </group>
          </group>
        )),
      )}
    </>
  );
}
function Dugouts() {
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 15, 0, 37.4]}>
          <mesh position={[0, 1.35, 0]} castShadow>
            <boxGeometry args={[9.5, 0.2, 2.8]} />
            <meshStandardMaterial
              color="#9fc7dd"
              transparent
              opacity={0.42}
              roughness={0.2}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 0.72, 1.3]} castShadow>
            <boxGeometry args={[9.5, 1.4, 0.16]} />
            <meshStandardMaterial color="#1b2831" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[8.6, 0.5, 0.6]} />
            <meshStandardMaterial color={s < 0 ? teams[0].color : teams[1].color} roughness={0.7} />
          </mesh>
          {[-1, 1].map((e) => (
            <mesh key={e} position={[e * 4.75, 0.8, 0]} castShadow>
              <boxGeometry args={[0.16, 1.6, 2.8]} />
              <meshStandardMaterial color="#243440" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
export function Stadium() {
  const sky = useMemo(() => skyTexture(), []);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[300, 28, 18]} />
        <meshBasicMaterial
          map={sky}
          side={THREE.BackSide}
          toneMapped={false}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <Stand deck={SIDE} rotation={0} seats={["#2b6fb8", "#1f4f86"]} />
      <Stand deck={SIDE} rotation={Math.PI} seats={["#2b6fb8", "#1f4f86"]} />
      <Stand deck={END} rotation={Math.PI / 2} seats={["#2f5fae", "#24488a"]} />
      <Stand deck={END} rotation={-Math.PI / 2} seats={["#b23644", "#8d2733"]} />
      <Crowd />
      <Boards />
      <Dugouts />
      <Floodlights />
      <BigScreen side={1} />
      <BigScreen side={-1} />
    </group>
  );
}
