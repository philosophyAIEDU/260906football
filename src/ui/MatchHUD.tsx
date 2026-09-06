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
            <span>준비 후 Space 패스 · F 슛</span>
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
      <div className="quick-controls">
        <span>{attack ? "공격" : "수비"}</span>
        <div>
          <kbd>Space</kbd>
          {attack ? "패스" : "압박"} <kbd>F</kbd>
          {attack ? "슛" : "슬라이딩"}
        </div>
        <div>
          <kbd>Tab</kbd>선수 전환 <kbd>C</kbd>카메라
        </div>
        <small>
          {Math.round(s.fps)} FPS ·{" "}
          {["방송 중계", "선수 시점", "전술 시점"][match.cameraMode]}
        </small>
      </div>
    </div>
  );
}
