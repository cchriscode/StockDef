import { describe, expect, it } from 'vitest';
import { Battle } from '../src/battle.js';
import { WAVE_TABLES } from '../src/balance.js';
import type { StageParams } from '../src/types.js';

function params(over: Partial<StageParams> = {}): StageParams {
  return {
    regionId: 'R1',
    aum: 2000, totalBaseIncome: 325, incomePerWave: 25, incomeLastWave: 25,
    heat: 1, lossRate: 0.7, maxLossRate: 0.95, maxLeverage: 1, payoutBase: 0.9, drawBand: 0.25,
    mode: 'hard', enemyHpMult: 1.3, enemyDpsMult: 1.3, enemyCountMult: 1,
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
  it('타워 건설: 골드 차감·슬롯 점유, 중복 건설 불가 (포탑 3종)', () => {
    const b = new Battle(params(), []);
    b.addGold(390); // limit 165 + spire 210 = 375
    expect(b.buildTower(0, 'limit')).toBe(true);
    expect(b.gold).toBe(225);
    expect(b.buildTower(0, 'cannon')).toBe(false); // 점유된 슬롯
    expect(b.buildTower(1, 'spire')).toBe(false); // FR-6.4e 스파이어는 사옥 위 불가
    expect(b.buildTower(2, 'spire')).toBe(true); // 지면 슬롯에는 가능
    expect(b.gold).toBe(15);
    expect(b.buildTower(1, 'cannon')).toBe(false); // 골드 부족
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
    expect(w6).toBe(6); // R1 W6 count=6, 보스 없음
    expect(b.previewWave(7).find((c) => c.type === 'boss')).toBeUndefined();
    const w13 = b.previewWave(13);
    expect(w13.find((c) => c.type === 'boss')?.count).toBe(1);
    expect(w13.reduce((s, c) => s + c.count, 0)).toBe(16 + 1); // W13 count=16 + 보스 (08-10 곡선 재조정)
  });
  it('타겟팅 모드 순환: first → last → strong → close → first (Bloons)', () => {
    const b = new Battle(params(), []);
    b.addGold(300);
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
  it('사옥에 닿은 적은 소멸하지 않고 그 자리에서 사옥을 계속 때린다 (FR-6.11)', () => {
    const b = new Battle(params(), []);
    const anyB = b as unknown as { enemies: { x: number; hp: number }[] };
    anyB.enemies.push({ id: 701, type: 'grunt', x: 14, hp: 100, maxHp: 100, baseSpeed: 60, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 10, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0 } as never);
    const hp0 = b.baseHP;
    b.advanceTo(b.t + 1);
    const hp1 = b.baseHP;
    expect(hp1).toBeLessThan(hp0);
    expect(anyB.enemies[0].hp).toBeGreaterThan(0); // 통과 소멸 없음
    b.advanceTo(b.t + 1);
    expect(b.baseHP).toBeLessThan(hp1); // 계속 깎는다
  });
  it('적 본진 HP 0 → 즉시 승리 (FR-6.10 조기 승리)', () => {
    const b = new Battle(params(), []);
    (b as unknown as { enemyBaseHP: number }).enemyBaseHP = 0;
    b.advanceTo(0.5);
    expect(b.phase).toBe('done');
    expect(b.victory).toBe(true);
    expect(b.enemyBaseDestroyed).toBe(true);
  });
  it('적 본진 위기 반격: HP 40%/20% 돌파 시 정예 분대 투입 (FR-6.10b)', () => {
    const b = new Battle(params(), []);
    b.enemyBaseHP = 110; // < 40% of 300
    advanceAlive(b, 1);
    expect(b.rageStage).toBe(1);
    const anyB = b as unknown as { pending: { wave: number }[] };
    const squad1 = b.enemies.length + anyB.pending.length;
    expect(squad1).toBeGreaterThanOrEqual(4); // 1단계 분대 4기
    b.enemyBaseHP = 50; // < 20%
    advanceAlive(b, 2);
    expect(b.rageStage).toBe(2);
  });
  it('위기 반격 충격파: 본진 앞 아군을 중원까지 밀어낸다 (FR-6.10b)', () => {
    const b = new Battle(params(), []);
    b.addGold(200);
    b.spawnUnit('trader');
    const u = b.units[0];
    u.x = 900; // 적 본진 앞까지 전진한 상태
    b.enemyBaseHP = 110; // 40% 돌파 → 반격 발동
    advanceAlive(b, 0.5);
    expect(u.knockUntil).toBeGreaterThan(0); // 넉백 시작
    advanceAlive(b, 1.6); // 밀려나는 시간(0.9s) 경과 (이후 재전진분 포함)
    expect(u.x).toBeLessThan(520); // 900 → 중원(500)까지 후퇴
  });
  it('자동 스킬: 방패 파쇄병 → 아군 보호막 제거 + 취약 표식 (FR-6.7c)', () => {
    const b = new Battle(params(), []);
    b.addGold(200);
    b.spawnUnit('shutter');
    const u = b.units[0];
    u.x = 480;
    u.absorb = 50; // 셔터 보호막 보유 상태
    u.absorbUntil = 99;
    const anyB = b as unknown as { enemies: unknown[] };
    anyB.enemies.push({ id: 910, type: 'shield', x: 500, hp: 200, maxHp: 200, baseSpeed: 0, dps: 20, armor: 0, mr: 0, air: false, size: 9, wave: 1, baseDmg: 0, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false, nextSkillAt: 0, lastSkillAt: -9, shieldUntil: 0, hasteUntil: 0, armorCutUntil: 0, armorCutPct: 0, dotUntil: 0, dotDps: 0, healBlockUntil: 0, knockUntil: 0, knockFrom: 0, knockTo: 0, stunImmuneUntil: 0, dpsBuffUntil: 0, dpsBuffPct: 0, vulnUntil: 0, vulnPct: 0 } as never);
    advanceAlive(b, 1);
    expect(u.absorb).toBe(0); // 보호막 파괴
    expect(u.markUntil).toBeGreaterThan(0); // 취약 표식 부여
  });
  it('자동 스킬: 곤봉병 종울림 강타 → 광역 기절, 재기절 면역 적용 (FR-6.5c)', () => {
    const b = new Battle(params(), []);
    b.addGold(200);
    b.spawnUnit('club');
    const u = b.units[0];
    u.x = 500;
    u.atkCount = 99; // 평타 조건 충족 상태로 세팅 (FR-6.5d)
    const anyB = b as unknown as { enemies: unknown[] };
    for (let i = 0; i < 3; i++) {
      anyB.enemies.push({ id: 930 + i, type: 'grunt', x: 520 + i * 12, hp: 900, maxHp: 900, baseSpeed: 0, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 0, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false, nextSkillAt: 999, lastSkillAt: -9, shieldUntil: 0, hasteUntil: 0, armorCutUntil: 0, armorCutPct: 0, dotUntil: 0, dotDps: 0, healBlockUntil: 0, knockUntil: 0, knockFrom: 0, knockTo: 0, stunImmuneUntil: 0, dpsBuffUntil: 0, dpsBuffPct: 0, vulnUntil: 0, vulnPct: 0 } as never);
    }
    advanceAlive(b, 1.2); // 큐 프레임 지연(0.27초) 이후 판정
    const es = b.enemies as unknown as { stunUntil: number; stunImmuneUntil: number; hp: number }[];
    expect(es.filter((e) => e.stunUntil > 0).length).toBeGreaterThanOrEqual(3); // 광역 기절
    expect(es[0].stunImmuneUntil).toBeGreaterThan(es[0].stunUntil); // 스턴락 방지 면역창
    expect(es[0].hp).toBeLessThan(900); // 피해 적용
  });
  it('자동 스킬: 트레이더 복리 참격 — 주기 도달 시 주변 광역 피해 (FR-6.5b)', () => {
    const b = new Battle(params(), []);
    b.addGold(100);
    b.spawnUnit('trader');
    const u = b.units[0];
    u.x = 500;
    u.nextSkillAt = 0.2;
    const anyB = b as unknown as { enemies: unknown[] };
    for (let i = 0; i < 3; i++) {
      anyB.enemies.push({ id: 920 + i, type: 'grunt', x: 520 + i * 10, hp: 500, maxHp: 500, baseSpeed: 0, dps: 0, armor: 0, mr: 0, air: false, size: 8, wave: 1, baseDmg: 0, healPerSec: 0, slowUntil: 0, slowPct: 0, stunUntil: 0, leaked: false } as never);
    }
    advanceAlive(b, 1);
    expect(u.lastSkillAt).toBeGreaterThan(0); // 시전됨
    for (const e of b.enemies) expect(e.hp).toBeLessThan(500); // 광역 3기 전부 피격
  });
  it('heat 반영: 점령 2개(1.04) → 적 수 ceil(count×1.04)', () => {
    const b = new Battle(params({ heat: 1.04 }), []);
    b.advanceTo(11); // 웨이브 1 (base 2) 스폰 직후
    const total = b.enemies.length + (b as unknown as { pending: unknown[] }).pending.length;
    expect(total).toBe(Math.ceil(2 * 1.04)); // = 3
  });
});
