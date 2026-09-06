import { teams } from "../data/teams";
import { useSettings } from "../store/settingsStore";
import { match } from "../game/MatchEngine";
import type { Settings, Formation, Tactic } from "../game/types";
import { formations, tacticLabels } from "../ai/formations";
export function MainMenu({
  help,
  settings,
  available = true,
}: {
  help: () => void;
  settings: () => void;
  available?: boolean;
}) {
  const { settings: s, update } = useSettings();
  return (
    <main className="menu">
      <div className="menu-top">
        <span className="brand-small">TE / FOOTBALL</span>
        <span className="edition">11 vs 11 · 3D MATCH</span>
      </div>
      <section className="menu-panel">
        <div className="eyebrow">THE BEAUTIFUL GAME</div>
        <h1>
          TOUCHLINE
          <br />
          <span>ELEVEN</span>
          <span className="title-dot">.</span>
        </h1>
        <p className="intro">당신의 패스에서 시작되는 경기.</p>
        <div className="team-picker" role="group" aria-label="조작할 팀 선택">
          {teams.map((team, i) => (
            <button
              key={team.short}
              aria-pressed={s.team === i}
              className={`team-card ${s.team === i ? "chosen" : ""} team-${i}`}
              onClick={() => update({ team: i as 0 | 1 })}
            >
              <span className="crest">
                {team.short.slice(0, 1)}
                <small>FC</small>
              </span>
              <span>
                <b>{team.name}</b>
                <small>
                  {i === 0 ? "홈 · 파란색 세로줄" : "원정 · 붉은색 가로줄"}
                </small>
              </span>
              <span className="team-check">{s.team === i ? "✓" : ""}</span>
            </button>
          ))}
        </div>
        <div className="match-options">
          <label>
            난이도
            <select
              value={s.difficulty}
              onChange={(e) =>
                update({ difficulty: e.target.value as Settings["difficulty"] })
              }
            >
              <option value="easy">쉬움</option>
              <option value="normal">보통</option>
              <option value="hard">어려움</option>
            </select>
          </label>
          <label>
            전·후반 각각
            <select
              value={s.halfMinutes}
              onChange={(e) => update({ halfMinutes: Number(e.target.value) })}
            >
              <option value={1}>1분 · 빠른 경기</option>
              <option value={3}>3분</option>
              <option value={5}>5분</option>
              <option value={10}>10분</option>
            </select>
          </label>
          <label>
            포메이션
            <select
              value={s.formation}
              onChange={(e) =>
                update({ formation: e.target.value as Formation })
              }
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
              onChange={(e) => update({ tactic: e.target.value as Tactic })}
            >
              {Object.entries(tacticLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!available && (
          <p className="graphics-warning" role="alert">
            이 브라우저에서 3D 가속을 사용할 수 없습니다. 하드웨어 가속을 켠
            데스크톱 브라우저에서 실행해 주세요.
          </p>
        )}
        <button
          className="start-button"
          disabled={!available}
          onClick={() => match.start(s)}
        >
          경기 시작 <span>▶</span>
        </button>
        <div className="menu-links">
          <button onClick={help}>
            조작 방법 <kbd>?</kbd>
          </button>
          <button onClick={settings}>
            설정 <span>⚙</span>
          </button>
        </div>
      </section>
      <div className="venue">
        <span>TOUCHLINE ARENA</span>
        <b>DAY MATCH</b>
        <small>ROYAL BLUE FC vs CRIMSON UNITED</small>
      </div>
      <footer className="menu-footer">
        <span>가상의 두 팀. 하나의 경기장.</span>
        <span>키보드 + 게임패드 지원</span>
      </footer>
    </main>
  );
}
