import {it,expect} from 'vitest';
import {opponentDifficulty,difficulty} from '../ai/decisionScoring';
import {createPlayers} from '../data/teams';
import {movePlayer} from '../entities/playerMovement';
it('easy reduces opposition pressure without weakening user teammates',()=>{expect(opponentDifficulty(1,0,'easy').pressure).toBeLessThan(difficulty.normal.pressure);expect(opponentDifficulty(0,0,'easy')).toBe(difficulty.normal);expect(opponentDifficulty(0,1,'easy')).toBe(difficulty.easy)});
it('easy opponent keeper has a slower reaction',()=>expect(difficulty.easy.keeperReaction).toBeGreaterThan(difficulty.normal.keeperReaction));
it('sprint increases speed using the same player attributes',()=>{const a=createPlayers()[9],b=createPlayers()[9];a.angle=b.angle=Math.PI/2;for(let i=0;i<90;i++){movePlayer(a,{x:1,z:0},false,false,1/60);movePlayer(b,{x:1,z:0},true,false,1/60)}expect(b.pos.x).toBeGreaterThan(a.pos.x);expect(b.energy).toBeLessThan(a.energy)});
