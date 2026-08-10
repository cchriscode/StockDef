import { describe, expect, it } from 'vitest';
import { Battle } from '../src/battle.js';
import { WAVE_TABLES } from '../src/balance.js';
import type { StageParams } from '../src/types.js';
const P = (): StageParams => ({ regionId:'R1', aum:2000, totalBaseIncome:325, incomePerWave:25, incomeLastWave:25, heat:1, lossRate:0.7, maxLossRate:0.95, maxLeverage:1, payoutBase:0.9, drawBand:0.25, towerSlots:3, maxPositions:24, waveCount:13, unitHpMult:1, towerDmgMult:1, unitCostMult:1, hasInfoResearch:false, waveTable:WAVE_TABLES.R1 });
const E = (id:number,x:number) => ({ id, type:'grunt', x, hp:5000, maxHp:5000, baseSpeed:20, dps:5, armor:0, mr:0, air:false, size:8, wave:1, baseDmg:10, healPerSec:0, slowUntil:0, slowPct:0, stunUntil:0, leaked:false, nextSkillAt:9999, lastSkillAt:-9, shieldUntil:0, hasteUntil:0, armorCutUntil:0, armorCutPct:0, dotUntil:0, dotDps:0, healBlockUntil:0, knockUntil:0, knockFrom:0, knockTo:0, stunImmuneUntil:0, dpsBuffUntil:0, dpsBuffPct:0, vulnUntil:0, vulnPct:0, airborneUntil:0, airborneFrom:0 });
function peak(key:'club'|'roundshield'|'foreman') {
  const b=new Battle(P(),[]); b.addGold(500); b.spawnUnit(key);
  const u=b.units[0]; u.x=500; u.atkCount=99;
  (b as unknown as {enemies:unknown[]}).enemies.push(E(1,510) as never);
  const e=b.enemies[0] as unknown as {x:number;stunUntil:number;airborneUntil:number};
  let maxX=e.x; const x0=e.x;
  for(let t=0.05;t<=1.6;t+=0.05){ b.baseHP=1000; b.advanceTo(t); maxX=Math.max(maxX,e.x); }
  return { key, pushed:+(maxX-x0).toFixed(1), stun:+e.stunUntil.toFixed(2), air:+e.airborneUntil.toFixed(2) };
}
// 회귀 방지: 넉백이 스턴·블로커 분기에 가려 죽어 있던 버그 (2026-08-10)
describe('FR-6.5c CC 적용', () => { it('넉백은 교전·기절 중에도 실제로 밀어낸다 + 내리찍기는 공중 띄움', () => {
  expect(peak('roundshield').pushed).toBeGreaterThan(50); // 방패 돌격 140px = 필드 77
  expect(peak('club').pushed).toBeGreaterThan(20); // 곤봉 50px = 필드 28
  expect(peak('foreman').air).toBeGreaterThan(0); // 내리찍기 = 공중 띄움
}); });

describe('FR-6.5e 유닛 재소환 쿨다운', () => {
  it('같은 유닛은 쿨다운 동안 재소환 불가, 다른 유닛도 전역 간격에 막힌다', () => {
    const b = new Battle(P(), []);
    b.addGold(5000);
    expect(b.spawnUnit('sniper')).toBe(true); // 저격수 5초
    expect(b.spawnUnit('sniper')).toBe(false); // 자기 쿨다운
    expect(b.spawnUnit('club')).toBe(false); // 전역 간격 0.7초
    for (let t = 0.1; t <= 1.0; t += 0.1) b.advanceTo(t);
    expect(b.spawnUnit('club')).toBe(true); // 전역 간격 경과
    expect(b.spawnCdLeft('sniper')).toBeGreaterThan(3); // 저격수는 여전히 대기
    for (let t = 1.1; t <= 6.2; t += 0.1) { b.baseHP = 1000; b.advanceTo(t); }
    expect(b.spawnCdLeft('sniper')).toBe(0);
    expect(b.spawnUnit('sniper')).toBe(true);
  });
});
