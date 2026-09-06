import { useEffect, useRef } from "react";
import { match } from "../game/MatchEngine";
export function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0,
      last = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 80) return;
      last = time;
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      const w = 260,
        h = 168;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(9,29,32,.78)";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(230,243,237,.36)";
      ctx.lineWidth = 1;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.beginPath();
      ctx.moveTo(w / 2, 5);
      ctx.lineTo(w / 2, h - 5);
      ctx.moveTo(w / 2 + 21, h / 2);
      ctx.arc(w / 2, h / 2, 21, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(5, 37, 38, 94);
      ctx.strokeRect(w - 43, 37, 38, 94);
      for (const p of match.players) {
        if (p.red) continue;
        const x = 5 + ((p.pos.x + 52.5) / 105) * (w - 10),
          y = 5 + ((p.pos.z + 34) / 68) * (h - 10);
        if (p.index === match.selected) {
          ctx.strokeStyle = "#ddff76";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle =
          p.slot === 0 ? "#f9cf4e" : p.teamId === 0 ? "#74a5ff" : "#fa747b";
        if (p.teamId === 0) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(x - 3, y - 3, 6, 6);
        if (p.index === match.owner) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(
        5 + ((match.ball.x + 52.5) / 105) * (w - 10),
        5 + ((match.ball.z + 34) / 68) * (h - 10),
        2.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={ref}
      width={260}
      height={168}
      className="minimap"
      aria-label="22명 선수와 공의 실시간 위치 지도"
    />
  );
}
