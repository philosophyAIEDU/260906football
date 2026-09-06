import { CameraControls } from "./CameraControls";
import { useMatch } from "../store/matchStore";
import { match } from "../game/MatchEngine";
import { teams } from "../data/teams";
import { MiniMap } from "./MiniMap";
export function MatchHUD() {
  const s = useMatch();
  const p = match.players[s.selected],
    attack =
      s.owner !== null && match.players[s.owner].teamId === match.settings.team;
  const minute =
    Math.min(
      45,
      Math.floor((s.elapsed / (match.settings.halfMinutes * 60)) * 45),
    ) +
    (s.half - 1) * 45;
  const seconds = Math.floor(
    ((s.elapsed / (match.settings.halfMinutes * 60)) * 45 * 60) % 60,
  );
  return (
    <div className="hud">
      <CameraControls />
      <div className="live-bug">
        <b>TE</b>
        <span>LIVE MATCH</span>
      </div>
      <div className="scoreboard">
        <span className="team-tag blue">{teams[0].short}</span>
        <strong>
          {s.score[0]} <i>:</i> {s.score[1]}
        </strong>
        <span className="team-tag red">{teams[1].short}</span>
        <div className="clock">
          <b>
            {String(minute).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </b>
          <small>{s.half === 1 ? "전반" : "후반"}</small>
        </div>
      </div>
      <button
        className="pause-icon"
        onClick={() => match.pause()}
        aria-label="일시 정지"
      >
        Ⅱ
      </button>
      {s.notice && (
        <div
          className={`notice ${s.phase === "goal" ? "goal-notice" : ""}`}
          role="status"
        >
          <small>
            {s.phase === "goal" ? "TOUCHLINE ELEVEN" : "MATCH EVENT"}
          </small>
          <strong>{s.notice}</strong>
          {["kickoff", "setPiece"].includes(s.phase) && (
            <span>준비 후 S 패스 · D 슛 · A 롱킥</span>
          )}
        </div>
      )}
      <div className="player-panel">
        <div
          className="player-number"
          style={{ borderColor: teams[p.teamId].color }}
        >
          {p.shirtNumber}
        </div>
        <div className="player-details">
          <small>
            {p.position} · {teams[p.teamId].name}
          </small>
          <strong>{p.name}</strong>
          <div
            className="stamina-track"
            aria-label={`체력 ${Math.round(s.energy)}%`}
          >
            <span
              style={{
                width: `${s.energy}%`,
                background: s.energy < 25 ? "#ff996b" : "#d6f679",
              }}
            />
          </div>
        </div>
        <span className="stamina-value">
          {Math.round(s.energy)}
          <small>STA</small>
        </span>
        {s.power > 0 && (
          <div className="power">
            <small>POWER</small>
            <div>
              <span
                style={{
                  width: `${s.power * 100}%`,
                  background: s.power > 0.9 ? "#ff796f" : "#f4d873",
                }}
              />
            </div>
          </div>
        )}
      </div>
      <MiniMap />
      <div className="simple-controls">
        <span>
          <kbd>↑ ↓ ← →</kbd> 이동
        </span>
        <span>
          <kbd>S</kbd> 패스
        </span>
        <span>
          <kbd>D</kbd> {attack ? "슛" : "태클"} <small>공 없으면 태클</small>
        </span>
        <span>
          <kbd>A</kbd> 롱킥
        </span>
        <span>
          <kbd>Shift</kbd> 달리기
        </span>
        <span>
          <kbd>C</kbd> 카메라
        </span>
        <span>
          <kbd>Esc</kbd> 일시 정지
        </span>
        <small>우리 팀이 공을 받으면 자동 전환</small>
      </div>
    </div>
  );
}
