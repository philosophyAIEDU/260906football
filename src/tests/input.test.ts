import { it, expect, afterEach } from "vitest";
import { input, keyboardAction } from "../systems/InputSystem";
afterEach(() => input.clear());
it("maps S to pass, D to shot/tackle and A to long kick", () => {
  expect(keyboardAction("KeyS")).toBe("Space");
  expect(keyboardAction("KeyD")).toBe("KeyF");
  expect(keyboardAction("KeyA")).toBe("KeyQ");
});
it("action keys never also move the player", () => {
  input.keys.add("KeyS");
  input.keys.add("KeyD");
  input.keys.add("KeyA");
  const frame = input.sample();
  expect(frame.x).toBe(0);
  expect(frame.y).toBe(0);
  expect(frame.press).toBe(false);
  expect(frame.teammatePress).toBe(false);
});
it("arrow keys control movement independently", () => {
  input.keys.add("ArrowUp");
  input.keys.add("ArrowRight");
  const frame = input.sample();
  expect(frame.x).toBe(1);
  expect(frame.y).toBe(1);
});

it('W enables sprint without changing the movement direction',()=>{input.keys.add('KeyW');input.keys.add('ArrowRight');const frame=input.sample();expect(frame.sprint).toBe(true);expect(frame.x).toBe(1);expect(frame.y).toBe(0);input.keys.delete('KeyW');expect(input.sample().sprint).toBe(false)});
