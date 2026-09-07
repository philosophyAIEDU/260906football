import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  BallCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { match } from "../game/MatchEngine";
import { BALL_RADIUS } from "../systems/RulesSystem";
import { ballTexture, softCircle } from "../stadium/textures";
export function Ball() {
  const ref = useRef<RapierRigidBody>(null);
  const shadow = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (ref.current) match.attachBall(ref.current);
    return () => {
      match.body = null;
    };
  }, []);
  // A contact patch that fades as the ball rises reads the height far better
  // than a shadow map alone at this distance.
  useFrame(() => {
    if (!shadow.current) return;
    const height = Math.max(0, match.ball.y - BALL_RADIUS);
    const spread = 1 + height * 0.5;
    shadow.current.position.set(match.ball.x, 0.014, match.ball.z);
    shadow.current.scale.setScalar(0.42 * spread);
    (shadow.current.material as THREE.MeshBasicMaterial).opacity =
      0.4 / (1 + height * 1.5);
  });
  return (
    <>
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
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[BALL_RADIUS, 40, 28]} />
          <meshStandardMaterial
            map={ballTexture()}
            bumpMap={ballTexture()}
            bumpScale={1.6}
            roughness={0.42}
            metalness={0.02}
            envMapIntensity={0.6}
          />
        </mesh>
      </RigidBody>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={softCircle()}
          color="#0c1a09"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
