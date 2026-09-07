import { useEffect, useRef } from "react";
import { match } from "../game/MatchEngine";
import { teams } from "../data/teams";
const W = 260,
  H = 168,
  PAD = 7;
export function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0,
      last = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 60) return;
      last = time;
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const inner = { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 };
      const field = ctx.createLinearGradient(0, 0, 0, H);
      field.addColorStop(0, "#12303aef");
      field.addColorStop(1, "#0a1f26ef");
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, W, H);
      // Mown bands, matching the pitch itself.
      ctx.fillStyle = "#ffffff08";
      for (let i = 0; i < 10; i += 2)
        ctx.fillRect(inner.x + (i * inner.w) / 10, inner.y, inner.w / 10, inner.h);
      const project = (x: number, z: number): [number, number] => [
        inner.x + ((x + 52.5) / 105) * inner.w,
        inner.y + ((z + 34) / 68) * inner.h,
      ];
      ctx.strokeStyle = "#dff0e880";
      ctx.lineWidth = 1;
      ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
      ctx.beginPath();
      ctx.moveTo(W / 2, inner.y);
      ctx.lineTo(W / 2, inner.y + inner.h);
      ctx.moveTo(W / 2 + 19, H / 2);
      ctx.arc(W / 2, H / 2, 19, 0, Math.PI * 2);
      ctx.stroke();
      const boxW = (16.5 / 105) * inner.w,
        boxH = (40.32 / 68) * inner.h;
      const sixW = (5.5 / 105) * inner.w,
        sixH = (18.32 / 68) * inner.h;
      for (const side of [-1, 1]) {
        const x = side < 0 ? inner.x : inner.x + inner.w - boxW;
        ctx.strokeRect(x, H / 2 - boxH / 2, boxW, boxH);
        ctx.strokeRect(
          side < 0 ? inner.x : inner.x + inner.w - sixW,
          H / 2 - sixH / 2,
          sixW,
          sixH,
        );
      }
      for (const p of match.players) {
        if (p.red) continue;
        const [x, y] = project(p.pos.x, p.pos.z);
        if (p.index === match.selected) {
          ctx.strokeStyle = "#d9ff7a";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle =
          p.slot === 0 ? "#f7cf52" : teams[p.teamId].color;
        ctx.strokeStyle = "#04141bcc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (p.index === match.owner) {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const [bx, by] = project(match.ball.x, match.ball.z);
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 8);
      glow.addColorStop(0, "#ffffffcc");
      glow.addColorStop(1, "#ffffff00");
      ctx.fillStyle = glow;
      ctx.fillRect(bx - 8, by - 8, 16, 16);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={ref}
      width={W * 2}
      height={H * 2}
      className="minimap"
      aria-label="22명 선수와 공의 실시간 위치 지도"
    />
  );
}
