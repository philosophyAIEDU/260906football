import type {Player,Vec3} from '../game/types';
import {distance} from '../game/math';
/** Keep the current player unless an eligible teammate has a clear advantage. */
export function nearbyController(players:Player[],team:number,current:number,ball:Vec3,velocity:Vec3,owner:number|null,receiver:number|null,excluded:Set<number>):number{
 if(owner!==null)return players[owner].teamId===team?owner:current;
 const future={x:ball.x+velocity.x*.2,z:ball.z+velocity.z*.2};
 const candidates=players.filter(p=>p.teamId===team&&!p.red&&!excluded.has(p.index)&&distance(p.pos,ball)<6&&(p.slot!==0||Math.abs(p.pos.x)>36));
 const score=(p:Player)=>distance(p.pos,future)-(p.index===receiver?.65:0);
 const best=candidates.sort((a,b)=>score(a)-score(b))[0];if(!best||best.index===current)return current;
 const active=players[current];return active.red||score(best)+1.2<score(active)?best.index:current;
}
