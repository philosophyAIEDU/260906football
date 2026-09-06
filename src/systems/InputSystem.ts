import type { Action, InputFrame } from "../game/types";
const handled = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyE",
  "KeyQ",
  "KeyF",
  "KeyZ",
  "KeyX",
  "KeyR",
  "Tab",
  "KeyC",
  "Escape",
];
const charged = ["Space", "KeyE", "KeyQ", "KeyF", "KeyZ", "KeyX"];
class InputSystem {
  keys = new Set<string>();
  started = new Map<string, number>();
  queue: Action[] = [];
  padPrevious: boolean[] = [];
  padStarted = new Map<number, number>();
  power = 0;
  connected = false;
  attach() {
    const down = (e: KeyboardEvent) => {
      if (
        !handled.includes(e.code) ||
        (e.target instanceof HTMLElement &&
          ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName))
      )
        return;
      e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (charged.includes(e.code)) this.started.set(e.code, performance.now());
      else this.queue.push({ key: e.code, power: 0.35 });
    };
    const up = (e: KeyboardEvent) => {
      if (!handled.includes(e.code)) return;
      e.preventDefault();
      this.keys.delete(e.code);
      if (this.started.has(e.code)) {
        this.queue.push({
          key: e.code,
          power: Math.min(
            1.4,
            (performance.now() - this.started.get(e.code)!) / 850 + 0.14,
          ),
        });
        this.started.delete(e.code);
      }
    };
    const clear = () => this.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      this.clear();
    };
  }
  clear() {
    this.keys.clear();
    this.started.clear();
    this.queue = [];
    this.power = 0;
    this.padStarted.clear();
    this.padPrevious = [];
  }
  sample(): InputFrame {
    const has = (...k: string[]) => k.some((x) => this.keys.has(x));
    let x =
        Number(has("KeyD", "ArrowRight")) - Number(has("KeyA", "ArrowLeft")),
      y = Number(has("KeyW", "ArrowUp")) - Number(has("KeyS", "ArrowDown"));
    let sprint = has("ShiftLeft", "ShiftRight"),
      protect = has("KeyR"),
      press = has("Space"),
      teammatePress = has("KeyQ"),
      aimX = 0,
      aimY = 0;
    this.power = 0;
    for (const time of this.started.values())
      this.power = Math.max(
        this.power,
        Math.min(1, (performance.now() - time) / 850),
      );
    const pad =
      typeof navigator !== "undefined"
        ? Array.from(navigator.getGamepads?.() ?? []).find(Boolean)
        : null;
    this.connected = !!pad;
    if (pad) {
      const dead = (v: number) => (Math.abs(v) > 0.18 ? v : 0);
      x += dead(pad.axes[0] ?? 0);
      y -= dead(pad.axes[1] ?? 0);
      aimX = dead(pad.axes[2] ?? 0);
      aimY = -dead(pad.axes[3] ?? 0);
      sprint ||= !!pad.buttons[5]?.pressed;
      protect ||= !!pad.buttons[7]?.pressed;
      press ||= !!pad.buttons[0]?.pressed;
      teammatePress ||= !!pad.buttons[2]?.pressed;
      const mapping: Record<number, string> = {
        0: "Space",
        1: "KeyF",
        2: "KeyQ",
        3: "KeyE",
        4: "Tab",
        7: "KeyR",
        9: "Escape",
      };
      for (const [id, key] of Object.entries(mapping)) {
        const i = Number(id),
          p = !!pad.buttons[i]?.pressed,
          old = this.padPrevious[i] ?? false;
        if (p && !old) {
          if (charged.includes(key)) this.padStarted.set(i, performance.now());
          else this.queue.push({ key, power: 0.35 });
        }
        if (!p && old && this.padStarted.has(i)) {
          this.queue.push({
            key,
            power: Math.min(
              1.4,
              (performance.now() - this.padStarted.get(i)!) / 850 + 0.14,
            ),
          });
          this.padStarted.delete(i);
        }
        this.padPrevious[i] = p;
      }
      for (const time of this.padStarted.values())
        this.power = Math.max(
          this.power,
          Math.min(1, (performance.now() - time) / 850),
        );
    } else {
      this.padPrevious = [];
      this.padStarted.clear();
    }
    const actions = this.queue.splice(0);
    return { x, y, sprint, protect, press, teammatePress, aimX, aimY, actions };
  }
}
export const input = new InputSystem();
