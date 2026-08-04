import { describe, expect, it } from 'vitest';
import { Battle } from '../src/battle.js';
import { WAVE_TABLES } from '../src/balance.js';
import type { StageParams } from '../src/types.js';

function params(over: Partial<StageParams> = {}): StageParams {
  return {
    regionId: 'R1',
    aum: 2000, totalBaseIncome: 325, incomePerWave: 25, incomeLastWave: 25,
    heat: 1, lossRate: 0.7, maxLossRate: 0.95, payoutBase: 0.9, drawBand: 0.25,
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
    b.addGold(200); // limit 110 + barrier 70 = 180
    expect(b.buildTower(0, 'limit')).toBe(true);
    expect(b.gold).toBe(90);
    expect(b.buildTower(0, 'dividend')).toBe(false); // 점유된 슬롯
    expect(b.buildTower(1, 'barrier')).toBe(true);
    expect(b.gold).toBe(20);
    expect(b.buildTower(2, 'limit')).toBe(false); // 골드 부족
  });
  it('배당 파밍: 주기마다 골드 생산 (비공격)', () => {
    const b = new Battle(params(), []);
    b.addGold(130);
    expect(b.buildTower(0, 'dividend')).toBe(true);
    const g0 = b.gold;
    advanceAlive(b, 21); // 10초 주기 × 2회
    expect(b.gold).toBeGreaterThanOrEqual(g0 + 16);
  });
  it('손절 방벽: 지상 적을 정지시키고 내구가 깎인다', () => {
    const b = new Battle(params(), []);
    b.addGold(70);
    expect(b.buildTower(0, 'barrier')).toBe(true); // slot0 x=100
    const anyB = b as unknown as { enemies: unknown[] };
    anyB.enemies.push({ id: 700, type: 'grunt', x: 112, hp: 500, maxHp: 500, baseSpeed: 30, dps: 10, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 10, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false } as never);
    const tw0 = b.towers[0]!;
    b.advanceTo(b.t + 2);
    expect(b.enemies[0].x).toBeGreaterThan(100); // 방벽에 막혀 통과 못 함
    expect(tw0.hp).toBeLessThan(tw0.maxHp); // 내구 감소
  });
  it('리스크 매니저: 사옥 체력을 회복시킨다 (BASE_HP 상한)', () => {
    const b = new Battle(params(), []);
    b.baseHP = 50;
    b.addGold(90);
    expect(b.spawnUnit('riskmgr')).toBe(true);
    b.advanceTo(4); // 웨이브 시작 전 (스폰 없음)
    expect(b.baseHP).toBeGreaterThan(51); // +0.5/s
    expect(b.baseHP).toBeLessThanOrEqual(100);
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
  it('조합 분배: 총 수 보존 + 보스 웨이브(R1은 W13만)는 보스 +1 (미리보기 기준)', () => {
    const b = new Battle(params(), []);
    const w6 = b.previewWave(6).reduce((s, c) => s + c.count, 0);
    expect(w6).toBe(7); // R1 W6 count=7, 보스 없음
    expect(b.previewWave(7).find((c) => c.type === 'boss')).toBeUndefined();
    const w13 = b.previewWave(13);
    expect(w13.find((c) => c.type === 'boss')?.count).toBe(1);
    expect(w13.reduce((s, c) => s + c.count, 0)).toBe(14 + 1); // W13 count=14 + 보스
  });
  it('타겟팅 모드 순환: first → last → strong → close → first (Bloons)', () => {
    const b = new Battle(params(), []);
    b.addGold(200);
    b.buildTower(0, 'limit');
    expect(b.towers[0]!.mode).toBe('first');
    expect(b.cycleTargeting(0)).toBe('last');
    expect(b.cycleTargeting(0)).toBe('strong');
    expect(b.cycleTargeting(0)).toBe('close');
    expect(b.cycleTargeting(0)).toBe('first');
  });
  it('armor는 물리 피해만 감소, 마법(공시폭탄)은 관통 (Kingdom Rush)', () => {
    const b = new Battle(params(), []);
    // 실드(armor 0.6, mr 0) 하나를 수동 주입
    const anyB = b as unknown as { enemies: { hp: number; maxHp: number; armor: number; mr: number; air: boolean; x: number; stunUntil: number }[] };
    b.addGold(500);
    anyB.enemies.push({ id: 999, type: 'shield', x: 500, hp: 100, maxHp: 100, baseSpeed: 0, dps: 0, armor: 0.6, mr: 0, air: false, size: 9, wave: 1, baseDmg: 0, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0 } as never);
    b.useSkill(); // 마법 80 → mr 0 → 정확히 80 피해
    expect(anyB.enemies[0].hp).toBeCloseTo(20, 5);
  });
  it('블로킹: 인턴은 3기까지 붙잡고 초과분은 통과한다 (Age of War 블로커)', () => {
    const b = new Battle(params(), []);
    const anyB = b as unknown as { enemies: unknown[]; units: unknown[] };
    b.addGold(100);
    b.spawnUnit('intern');
    const u = b.units[0];
    u.x = 500;
    for (let i = 0; i < 5; i++) {
      anyB.enemies.push({ id: 900 + i, type: 'grunt', x: 510, hp: 1000, maxHp: 1000, baseSpeed: 30, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 10, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0 } as never);
    }
    const xs0 = b.enemies.map((e) => e.x);
    b.advanceTo(b.t + 1);
    const moved = b.enemies.filter((e, i) => e.x < xs0[i] - 5).length;
    expect(moved).toBe(2); // 3기는 블로킹, 2기는 통과
  });
  it('힐러: 주변 지상 아군을 회복시킨다', () => {
    const b = new Battle(params(), []);
    const anyB = b as unknown as { enemies: { hp: number }[] };
    anyB.enemies.push({ id: 800, type: 'healer', x: 500, hp: 100, maxHp: 100, baseSpeed: 0, dps: 0, armor: 0, mr: 0.3, air: false, size: 8, wave: 1, baseDmg: 0, healPerSec: 9, slowUntil: 0, slowPct: 0, stunUntil: 0 } as never);
    anyB.enemies.push({ id: 801, type: 'grunt', x: 540, hp: 50, maxHp: 100, baseSpeed: 0, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 0, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0 } as never);
    b.advanceTo(b.t + 2);
    expect(anyB.enemies[1].hp).toBeGreaterThan(60); // ~9HP/s × 2s
  });
  it('적 처치 → AUM 획득 (공시폭탄으로 그런트 처치 = aumBounty 2)', () => {
    const b = new Battle(params(), []);
    const anyB = b as unknown as { enemies: unknown[] };
    b.addGold(500);
    anyB.enemies.push({ id: 700, type: 'grunt', x: 500, hp: 10, maxHp: 10, baseSpeed: 0, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 10, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false } as never);
    b.useSkill(); // 마법 80 → 즉사
    expect(b.aumEarned).toBe(2);
  });
  it('본진 도달로 소멸한 적은 AUM을 주지 않는다', () => {
    const b = new Battle(params(), []);
    const anyB = b as unknown as { enemies: unknown[] };
    anyB.enemies.push({ id: 701, type: 'grunt', x: 14, hp: 100, maxHp: 100, baseSpeed: 60, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 10, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false } as never);
    const hp0 = b.baseHP;
    b.advanceTo(b.t + 1); // 본진 도달
    expect(b.baseHP).toBeLessThan(hp0);
    expect(b.aumEarned).toBe(0);
  });
  it('적 본진 HP 0 → 즉시 승리 (FR-6.10 조기 승리)', () => {
    const b = new Battle(params(), []);
    (b as unknown as { enemyBaseHP: number }).enemyBaseHP = 0;
    b.advanceTo(0.5);
    expect(b.phase).toBe('done');
    expect(b.victory).toBe(true);
    expect(b.enemyBaseDestroyed).toBe(true);
  });
  it('heat 반영: 점령 2개(1.04) → 적 수 ceil(count×1.04)', () => {
    const b = new Battle(params({ heat: 1.04 }), []);
    b.advanceTo(11); // 웨이브 1 (base 3) 스폰 직후
    const total = b.enemies.length + (b as unknown as { pending: unknown[] }).pending.length;
    expect(total).toBe(Math.ceil(3 * 1.04)); // = 4
  });
});
