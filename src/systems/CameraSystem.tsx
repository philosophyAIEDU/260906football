import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { match } from "../game/MatchEngine";
import { clamp } from "../game/math";
export function CameraSystem() {
  const target = useMemo(() => new THREE.Vector3(), []),
    position = useMemo(() => new THREE.Vector3(), []),
    look = useMemo(() => new THREE.Vector3(), []),
    forward = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    const p = match.players[match.selected];
    const menu = match.phase === "menu";
    if (menu) {
      target.set(2, 0, 0);
      position.set(62, 51, 68);
    } else {
      const x = clamp(
          match.ball.x * 0.7 + p.pos.x * 0.3 + match.ballVelocity.x * 0.12,
          -38,
          38,
        ),
        z = clamp(match.ball.z * 0.7 + p.pos.z * 0.3, -22, 22);
      target.set(x, 0.5, z);
      if (match.phase === "goal") {
        const scorer = match.players[match.lastTouch];
        target.set(scorer.pos.x, 1, scorer.pos.z);
        position.set(
          scorer.pos.x - match.dir(scorer.teamId) * 9,
          7,
          scorer.pos.z + 11,
        );
      } else if (match.cameraMode === 0) {
        const wide = clamp(
          Math.hypot(match.ballVelocity.x, match.ballVelocity.z) * 0.25,
          0,
          8,
        );
        position.set(x + 3, 42 + wide, z + 47 + wide);
      } else if (match.cameraMode === 1) {
        const dir = match.dir(p.teamId);
        position.set(p.pos.x - dir * 12, 8, p.pos.z + 5);
        target.set(p.pos.x + dir * 7, 1, p.pos.z);
      } else {
        position.set(x, 76, z + 16);
      }
    }
    camera.position.lerp(position, 1 - Math.exp(-dt * (menu ? 2 : 3)));
    look.lerp(target, 1 - Math.exp(-dt * 5));
    camera.lookAt(look);
    camera.getWorldDirection(forward);
    match.forward.x = forward.x;
    match.forward.z = forward.z;
  });
  return null;
}
