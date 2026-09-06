import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { GameCanvas } from "./game/GameCanvas";
import { MainMenu } from "./ui/MainMenu";
import { MatchHUD } from "./ui/MatchHUD";
import { MatchResult } from "./ui/MatchResult";
import { ControlsHelp } from "./ui/ControlsHelp";
import { SettingsPanel } from "./ui/SettingsPanel";
import { useMatch } from "./store/matchStore";
import { match } from "./game/MatchEngine";
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        <h2>3D 화면을 시작하지 못했습니다</h2>
        <p>브라우저의 하드웨어 가속을 켠 뒤 새로고침해 주세요.</p>
        <button onClick={() => location.reload()}>새로고침</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Modal({
  children,
  close,
}: {
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="modal"
    >
      <button className="close" onClick={close} aria-label="닫기">
        ×
      </button>
      {children}
    </dialog>
  );
}
function supportsWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}
export default function App() {
  const [webgl] = useState(supportsWebGL);
  const phase = useMatch((s) => s.phase);
  const [modal, setModal] = useState<"help" | "settings" | null>(null);
  return (
    <div className="app-shell">
      <div className="scene">
        {webgl && (
          <SceneBoundary>
            <GameCanvas />
          </SceneBoundary>
        )}
      </div>
      {phase === "menu" ? (
        <MainMenu
          available={webgl}
          help={() => setModal("help")}
          settings={() => setModal("settings")}
        />
      ) : (
        <MatchHUD />
      )}
      {phase === "paused" && (
        <div className="overlay">
          <section className="pause-panel">
            <div className="eyebrow">MATCH PAUSED</div>
            <h2>잠시 쉬어가세요.</h2>
            <button className="start-button" onClick={() => match.pause()}>
              경기 계속하기 <span>▶</span>
            </button>
            <button onClick={() => match.start(match.settings)}>
              다시 시작
            </button>
            <button onClick={() => setModal("help")}>조작 방법</button>
            <button onClick={() => setModal("settings")}>설정</button>
            <button onClick={() => match.menu()}>메인 메뉴</button>
          </section>
        </div>
      )}
      {(phase === "halftime" || phase === "finished") && (
        <div className="overlay result-overlay">
          <MatchResult half={phase === "halftime"} />
        </div>
      )}
      {modal && (
        <Modal close={() => setModal(null)}>
          {modal === "help" ? <ControlsHelp /> : <SettingsPanel />}
        </Modal>
      )}
    </div>
  );
}
