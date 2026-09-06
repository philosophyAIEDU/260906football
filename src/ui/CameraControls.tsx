import { useState } from "react";
import { match } from "../game/MatchEngine";
import { useSettings } from "../store/settingsStore";
export function CameraControls() {
  const [open, setOpen] = useState(false);
  const { settings, update } = useSettings();
  return (
    <div className="camera-controls">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        카메라 ▾
      </button>
      {open && (
        <div className="camera-options">
          <div>
            {["중계", "선수 뒤", "전술"].map((name, i) => (
              <button
                key={name}
                aria-pressed={match.cameraMode === i}
                onClick={() => {
                  match.cameraMode = i as 0 | 1 | 2;
                  update({ camera: i as 0 | 1 | 2 });
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <label>
            거리 · 가까이 / 멀리
            <input
              aria-label="카메라 거리"
              type="range"
              min="0.65"
              max="1.5"
              step="0.05"
              value={settings.cameraDistance ?? 1}
              onChange={(e) =>
                update({ cameraDistance: Number(e.target.value) })
              }
            />
          </label>
          <label>
            높이 · 낮게 / 높게
            <input
              aria-label="카메라 높이"
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={settings.cameraHeight ?? 1}
              onChange={(e) => update({ cameraHeight: Number(e.target.value) })}
            />
          </label>
          <button
            onClick={() => update({ cameraDistance: 1, cameraHeight: 1 })}
          >
            거리·높이 초기화
          </button>
        </div>
      )}
    </div>
  );
}
