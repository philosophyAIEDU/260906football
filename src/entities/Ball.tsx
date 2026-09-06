import { useEffect, useMemo, useRef } from "react";
import {
  RigidBody,
  BallCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { match } from "../game/MatchEngine";
import { BALL_RADIUS } from "../systems/RulesSystem";
import * as THREE from "three";
export function Ball() {
  const ref = useRef<RapierRigidBody>(null);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#faf9ed";
    ctx.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 8; col++) {
        const x = col * 72 + (row % 2) * 36,
          y = row * 76;
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const a = (j * Math.PI * 2) / 5;
          ctx.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17);
        }
        ctx.closePath();
        ctx.fillStyle = "#162b40";
        ctx.fill();
        ctx.strokeStyle = "#a8b2b7";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => {
    if (ref.current) match.attachBall(ref.current);
    return () => {
      match.body = null;
      texture.dispose();
    };
  }, [texture]);
  return (
    <RigidBody
      ref={ref}
      colliders={false}
      position={[0, BALL_RADIUS + 0.02, 0]}
      linearDamping={0.08}
      angularDamping={0.4}
      ccd
      additionalSolverIterations={4}
      canSleep
    >
      <BallCollider
        args={[BALL_RADIUS]}
        mass={0.43}
        friction={0.6}
        restitution={0.42}
      />
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 20, 14]} />
        <meshStandardMaterial map={texture} roughness={0.72} />
      </mesh>
    </RigidBody>
  );
}
