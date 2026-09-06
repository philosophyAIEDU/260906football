import { match } from "../game/MatchEngine";
import { useMatch } from "../store/matchStore";
import { possessionPercent, percent } from "../systems/StatisticsSystem";
export function MatchResult({ half = false }: { half?: boolean }) {
  const s = useMatch();
  const [a, b] = s.stats;
  const mvp = [...match.players].sort(
    (a, b) => b.goals * 5 + b.assists * 3 - (a.goals * 5 + a.assists * 3),
  )[0];
  const rows: [string, string | number, string | number][] = [
    ["점유율", `${possessionPercent(a, b)}%`, `${possessionPercent(b, a)}%`],
    [
      "슈팅 / 유효 슈팅",
      `${a.shots} / ${a.onTarget}`,
      `${b.shots} / ${b.onTarget}`,
    ],
    [
      "패스 / 성공률",
      `${a.passes} / ${percent(a.completed, a.passes)}%`,
      `${b.passes} / ${percent(b.completed, b.passes)}%`,
    ],
    [
      "태클 / 성공",
      `${a.tackles} / ${a.tacklesWon}`,
      `${b.tackles} / ${b.tacklesWon}`,
    ],
    ["코너킥", a.corners, b.corners],
    ["프리킥 · 페널티킥", a.freeKicks, b.freeKicks],
    ["파울", a.fouls, b.fouls],
    ["오프사이드", a.offsides, b.offsides],
    ["경고 / 퇴장", `${a.yellows} / ${a.reds}`, `${b.yellows} / ${b.reds}`],
    ["골키퍼 선방", a.saves, b.saves],
  ];
  return (
    <div className="result">
      <div className="eyebrow">{half ? "HALF TIME" : "FULL TIME"}</div>
      <h2>
        {half ? "잠시 숨을 고르고, 다시 경기장으로." : "경기가 종료되었습니다."}
      </h2>
      <div className="result-score">
        <span>ROYAL BLUE FC</span>
        <b>
          {s.score[0]} : {s.score[1]}
        </b>
        <span>CRIMSON UNITED</span>
      </div>
      <div className="stats-list">
        {rows.map(([label, a, b]) => (
          <div key={label}>
            <b>{a}</b>
            <span>{label}</span>
            <b>{b}</b>
          </div>
        ))}
      </div>
      <div className="scorers">
        {s.events
          .filter((e) => e.kind === "goal")
          .map((e, i) => (
            <span key={i}>
              {e.minute}′ {e.text}
            </span>
          ))}
      </div>
      {!half && (
        <p className="mvp">
          {mvp.goals + mvp.assists > 0
            ? `공격 포인트 기준 MVP · ${mvp.name} (${mvp.goals}골 ${mvp.assists}도움)`
            : "공격 포인트가 없어 MVP를 선정하지 않았습니다."}
        </p>
      )}
      <button
        className="start-button"
        onClick={() =>
          half ? match.secondHalf() : match.start(match.settings)
        }
      >
        {half ? "후반 시작 · 진영 교체" : "다시 경기"}
      </button>
      <button className="text-button" onClick={() => match.menu()}>
        메인 메뉴
      </button>
    </div>
  );
}
