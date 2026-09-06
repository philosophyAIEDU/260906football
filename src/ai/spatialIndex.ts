import type { Player, Vec } from "../game/types";
export class SpatialIndex {
  private cells = new Map<string, Player[]>();
  rebuild(players: Player[]) {
    this.cells.clear();
    for (const p of players) {
      if (p.red) continue;
      const key = `${Math.floor(p.pos.x / 5)},${Math.floor(p.pos.z / 5)}`;
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(p);
      else this.cells.set(key, [p]);
    }
  }
  near(pos: Vec): Player[] {
    const out: Player[] = [];
    const x = Math.floor(pos.x / 5),
      z = Math.floor(pos.z / 5);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const bucket = this.cells.get(`${x + i},${z + j}`);
        if (bucket) out.push(...bucket);
      }
    return out;
  }
}
