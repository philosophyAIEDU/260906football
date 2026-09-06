import { useSettings } from "../store/settingsStore";
import { formations, tacticLabels } from "../ai/formations";
import type { Settings, Formation, Tactic } from "../game/types";
import { audio } from "../systems/AudioSystem";
import { match } from "../game/MatchEngine";
export function SettingsPanel() {
  const { settings: s, update } = useSettings();
  const set = (change: Partial<Settings>) => {
    update(change);
    const next = { ...s, ...change };
    audio.update(next);
    match.settings = {
      ...match.settings,
      difficulty:next.difficulty,
      formation: next.formation,
      tactic: next.tactic,
      offside: next.offside,
      passAssist: next.passAssist,
      volume: next.volume,
      crowdVolume: next.crowdVolume,
      effectsVolume: next.effectsVolume,
      muted: next.muted,
    };
  };
  return (
    <div>
      <h2>경기 설정</h2>
      <div className="settings-grid"><label>경기 난이도<select value={s.difficulty} onChange={e=>set({difficulty:e.target.value as Settings["difficulty"]})}><option value="easy">쉬움 · 압박 완화</option><option value="normal">보통</option><option value="hard">어려움</option></select></label>
        <label>
          포메이션
          <select
            value={s.formation}
            onChange={(e) => set({ formation: e.target.value as Formation })}
          >
            {Object.keys(formations).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          팀 전술
          <select
            value={s.tactic}
            onChange={(e) => set({ tactic: e.target.value as Tactic })}
          >
            {Object.entries(tacticLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          그래픽 품질
          <select
            value={s.quality}
            onChange={(e) =>
              set({ quality: e.target.value as Settings["quality"] })
            }
          >
            <option value="low">낮음</option>
            <option value="medium">중간</option>
            <option value="high">높음</option>
          </select>
        </label>
        <label>
          패스 보조
          <select
            value={s.passAssist}
            onChange={(e) =>
              set({ passAssist: e.target.value as Settings["passAssist"] })
            }
          >
            <option value="high">높음</option>
            <option value="medium">중간</option>
            <option value="low">낮음 · 수동</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.offside}
            onChange={(e) => set({ offside: e.target.checked })}
          />
          오프사이드 적용
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.muted}
            onChange={(e) => set({ muted: e.target.checked })}
          />
          음소거
        </label>
        {(["volume", "crowdVolume", "effectsVolume"] as const).map((key, i) => (
          <label key={key}>
            {["전체 음량", "관중 음량", "효과음 음량"][i]}
            <input
              aria-label={["전체 음량", "관중 음량", "효과음 음량"][i]}
              type="range"
              min="0"
              max="1"
              step=".05"
              value={s[key]}
              onChange={(e) => set({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <p className="muted">
        카메라 흔들림은 사용하지 않습니다. 설정은 이 브라우저에 저장됩니다.
      </p>
    </div>
  );
}
