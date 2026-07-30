import { describe, expect, it } from 'vitest';
import { Battle } from '../src/battle.js';
import { WAVE_TABLES } from '../src/balance.js';
import type { StageParams } from '../src/types.js';

function params(over: Partial<StageParams> = {}): StageParams {
  return {
    aum: 2000, totalBaseIncome: 325, incomePerWave: 25, incomeLastWave: 25,
    heat: 1, lossRate: 0.6, payoutBase: 0.9, drawBand: 0.25,
    towerSlots: 6, maxPositions: 24, waveCount: 13,
    unitHpMult: 1, towerDmgMult: 1, unitCostMult: 1, hasInfoResearch: false,
    waveTable: WAVE_TABLES.R1,
    ...over,
  };
}

/** 본진 파괴로 시뮬이 조기 종료되지 않도록 HP를 유지하며 진행 (테스트 전용) */
function advanceAlive(b: Battle, until: number) {
  for (let t = 0.5; t <= until; t += 0.5) {
    b.baseHP = 1000;
    b.advanceTo(t);
  }
}

describe('Battle 엔진', () => {
  it('웨이브 시작마다 기본 수입 지급 — 13웨이브 총액 = totalBaseIncome', () => {
    const b = new Battle(params(), []);
    advanceAlive(b, 12 * 30 + 1); // 마지막 웨이브 시작 직후
    expect(b.goldEarned).toBe(325);
  });
  it('방어 없이 방치하면 본진 파괴로 수입이 끊긴다 (조기 종료)', () => {
    const b = new Battle(params(), []);
    b.advanceTo(12 * 30 + 1);
    expect(b.goldEarned).toBeLessThan(325);
    expect(b.victory).toBe(false);
  });
  it('타워 건설: 골드 차감·슬롯 점유, 중복 건설 불가', () => {
    const b = new Battle(params(), []);
    b.addGold(300);
    expect(b.buildTower(0, 'basic')).toBe(true);
    expect(b.gold).toBe(180);
    expect(b.buildTower(0, 'aa')).toBe(false); // 점유된 슬롯
    expect(b.buildTower(1, 'splash')).toBe(true);
    expect(b.gold).toBe(20);
    expect(b.buildTower(2, 'basic')).toBe(false); // 골드 부족
  });
  it('패닉 셀 이벤트 → 다음 웨이브 적 수 1.3배 (FR-7 수용 기준)', () => {
    // t=200(웨이브 7 진행 중) 발동 → 웨이브 8에 적용. 웨이브 8 base count = 8
    const spawnOfWave8 = (events: Parameters<typeof Battle.prototype.constructor>[1]) => {
      const b = new Battle(params(), events as never);
      advanceAlive(b, 7 * 30 + 12); // 웨이브 8 스폰 스케줄 완료 시점
      const pending = (b as unknown as { pending: { wave: number }[] }).pending;
      return b.enemies.filter((e) => e.wave === 8).length + pending.filter((p) => p.wave === 8).length;
    };
    expect(spawnOfWave8([])).toBe(8);
    expect(spawnOfWave8([{ t: 200, type: 'panic_sell', strength: 1.4 }])).toBe(Math.ceil(8 * 1.3));
  });
  it('방치 시 본진 HP 0 → 패배 (phase done, victory=false)', () => {
    const b = new Battle(params(), []);
    b.advanceTo(390 + 40);
    expect(b.baseHP).toBe(0);
    expect(b.victory).toBe(false);
  });
  it('heat 반영: 점령 2개(1.04) → 적 수 ceil(count×1.04)', () => {
    const b = new Battle(params({ heat: 1.04 }), []);
    b.advanceTo(11); // 웨이브 1 (base 3) 스폰 직후
    const total = b.enemies.length + (b as unknown as { pending: unknown[] }).pending.length;
    expect(total).toBe(Math.ceil(3 * 1.04)); // = 4
  });
});
