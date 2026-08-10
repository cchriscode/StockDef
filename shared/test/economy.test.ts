import { describe, expect, it } from 'vitest';
import { baseIncome, heatOf, judge, settle, sltpHit, sltpValid, sltpWickHit, splitPayout, tradeFee } from '../src/economy.js';
import { BALANCE, DEPT_EFFECTS } from '../src/balance.js';

describe('FR-6.8 기본 수입 — 총액 우선 분배', () => {
  it('점령 2개 → 총 275, 웨이브 1~12 각 21, 웨이브 13 = 23 (PRD 예시)', () => {
    const r = baseIncome(2);
    expect(r.total).toBe(275);
    expect(r.perWave).toBe(21);
    expect(r.lastWave).toBe(23);
    expect(r.perWave * 12 + r.lastWave).toBe(r.total);
  });
  it('점령 0개 → 총 325 (R1)', () => {
    expect(baseIncome(0).total).toBe(325);
  });
  it('재무 보상 1개 → 지역당 운영비 15로 감소', () => {
    expect(baseIncome(2, 13, 1).total).toBe(325 - 2 * 15);
  });
  it('heat: 점령 2개 → 1.04 (FR-6.7 수용 기준)', () => {
    expect(heatOf(2)).toBeCloseTo(1.04);
  });
});

describe('FR-5.5 청산 손익 (선물식 연속 PnL)', () => {
  it('수용 기준: 25% 투입 500 · long · g=+1.0 → payout 950 (500 × (1 + 0.9×1.0))', () => {
    // g=1.0이 되는 가격 구성: σ=1.0, Δ=+1.0%
    const r = judge(10000, 10100, 1.0, 'long', 500, 0.6);
    expect(r.outcome).toBe('win');
    expect(r.g).toBeCloseTo(1.0);
    expect(r.payout).toBe(950);
    expect(r.pnl).toBe(450);
  });
  it('수용 기준: 하방 계수 L=1.7 (R3) · 역방향 g=−0.5 → payout = 1000 × (1 − 0.85) = 150', () => {
    const r = judge(10000, 10050, 1.0, 'short', 1000, 1.7);
    expect(r.outcome).toBe('lose');
    expect(r.payout).toBe(150);
  });
  it('작은 역방향 손실은 연속 반영: g=−0.5, L=0.7 (R1) → payout = 500 × (1 − 0.35) = 325', () => {
    const r = judge(10000, 10050, 1.0, 'short', 500, 0.7);
    expect(r.outcome).toBe('lose');
    expect(r.payout).toBe(325);
  });
  it('승패는 실현 손익 부호 기준 — 작은 수익도 WIN (2026-08-05 DRAW_BAND 폐지)', () => {
    const r = judge(10000, 10010, 1.0, 'long', 500, 0.6);
    expect(r.outcome).toBe('win');
    expect(r.payout).toBe(545); // 500 × (1 + 0.9×0.1)
  });
  it('pnl = 0 (가격 무변동) → DRAW', () => {
    const r = judge(10000, 10000, 1.0, 'long', 500, 0.6);
    expect(r.outcome).toBe('draw');
    expect(r.pnl).toBe(0);
  });
  it('상방은 Z_CAP=3.0에서 클램프: g=+10 → payout = stake × 3.7', () => {
    const r = judge(10000, 11000, 1.0, 'long', 100, 0.6);
    expect(r.payout).toBe(370);
  });
  it('하방은 MAX_LOSS_RATE=0.95에서 클램프: g=−50, L=1.7 → payout = stake × 0.05', () => {
    const r = judge(10000, 15000, 1.0, 'short', 100, 1.7);
    expect(r.outcome).toBe('lose');
    expect(r.payout).toBe(5);
  });
  it('청산 분해: 순수익은 500G까지만 골드, 초과분은 AUM (FR-5.5c)', () => {
    const small = splitPayout(1300, 1000); // 수익 300 → 전액 골드
    expect(small).toEqual({ returnToAum: 1000, goldGain: 300 });
    const big = splitPayout(2200, 1000); // 수익 1200 → 골드 500 + AUM 700
    expect(big).toEqual({ returnToAum: 1700, goldGain: 500 });
    expect(big.returnToAum + big.goldGain).toBe(2200); // 총액 보존
    const loss = splitPayout(400, 1000); // 손실 → 전액 AUM 반환, 골드 0
    expect(loss).toEqual({ returnToAum: 400, goldGain: 0 });
  });
  it('레버리지: g에 곱해 양방향 증폭, 손실은 여전히 MAX_LOSS_RATE 클램프 (FR-5.6b)', () => {
    const lev3 = judge(10000, 10100, 1.0, 'long', 500, 0.7, 3); // g = 1×3 → payout 500×(1+0.9×3)
    expect(lev3.payout).toBe(1850);
    expect(lev3.payout).toBeGreaterThan(judge(10000, 10100, 1.0, 'long', 500, 0.7).payout);
    const loss5 = judge(10000, 9900, 1.0, 'long', 500, 1.7, 5); // g = −1×5 → L×g=−8.5 → −0.95 클램프
    expect(loss5.payout).toBe(25); // 500 × 0.05
  });
});

describe('FR-8 정산·등급·보상 자격', () => {
  it('수용 기준: 운용성과 +20% · 적중률 68% · HP 95 · 적본진 미파괴 → 6점 S, 자격 3계열', () => {
    const r = settle({
      goldLeft: 250, goldEarnedTotal: 1000, aumLeft: 2400, aumInitial: 2000, hpLeft: 95,
      wins: 17, loses: 8, enemyBaseDestroyed: false, isRetry: false, irBonus: 0,
    });
    expect(r.gradePoints).toBe(6);
    expect(r.grade).toBe('S');
    expect(r.eligibleLines.sort()).toEqual(['defense', 'finance', 'info']);
  });
  it('적중률 보너스는 상위만 적용 (0.7 이상 → +0.30, +0.15와 중복 아님)', () => {
    const hi = settle({ goldLeft: 100, goldEarnedTotal: 1000, aumLeft: 2000, aumInitial: 2000, hpLeft: 50, wins: 7, loses: 3, enemyBaseDestroyed: false, isRetry: false, irBonus: 0 });
    // base 100 × (1+0.3) × B(1.1: AUM 보전 1점 + 적중 2점 = 3점) = 143
    expect(hi.capital).toBe(Math.floor(100 * 1.3 * 1.1));
  });
  it('재도전 → 자본금 50% (FR-8.1)', () => {
    const base = { goldLeft: 400, goldEarnedTotal: 1000, aumLeft: 200, aumInitial: 0, hpLeft: 100, wins: 8, loses: 2, enemyBaseDestroyed: true, isRetry: false, irBonus: 0 };
    const normal = settle(base);
    const retry = settle({ ...base, isRetry: true });
    expect(retry.capital).toBe(Math.floor(normal.capital * 0.5));
  });
  it('DRAW는 적중률 분모에서 제외', () => {
    const r = settle({ goldLeft: 0, goldEarnedTotal: 1000, aumLeft: 0, aumInitial: 0, hpLeft: 10, wins: 6, loses: 4, enemyBaseDestroyed: false, isRetry: false, irBonus: 0 });
    expect(r.accuracy).toBeCloseTo(0.6);
  });
});

describe('FR-5.13 거래 횟수 제한', () => {
  it('기본 10회, 리서치 데스크 레벨당 +5회', () => {
    expect(BALANCE.MAX_POSITIONS).toBe(10);
    expect(DEPT_EFFECTS.maxPositions(1)).toBe(10);
    expect(DEPT_EFFECTS.maxPositions(2)).toBe(15);
    expect(DEPT_EFFECTS.maxPositions(3)).toBe(20);
  });
});

describe('FR-5.14 거래 수수료', () => {
  it('명목가(스테이크 × 배율) 비례 — 배율이 높을수록 비싸다', () => {
    expect(tradeFee(1000, 1)).toBe(Math.round(1000 * BALANCE.FEE_RATE));
    expect(tradeFee(1000, 5)).toBe(tradeFee(1000, 1) * 5);
  });
  it('반올림으로 0이 되지 않게 최소 1', () => {
    expect(tradeFee(1, 1)).toBe(1);
  });
});

describe('FR-5.15 손절·익절', () => {
  it('롱은 손절이 진입가 아래·익절이 위여야 유효', () => {
    expect(sltpValid('long', 100, 95, 110)).toBe(true);
    expect(sltpValid('long', 100, 105, 110)).toBe(false); // 손절이 위
    expect(sltpValid('long', 100, 95, 90)).toBe(false); // 익절이 아래
  });
  it('숏은 방향이 반대', () => {
    expect(sltpValid('short', 100, 105, 90)).toBe(true);
    expect(sltpValid('short', 100, 95, 90)).toBe(false);
  });
  it('한쪽만 지정해도 유효 (null = 미지정)', () => {
    expect(sltpValid('long', 100, null, 110)).toBe(true);
    expect(sltpValid('long', 100, 95, null)).toBe(true);
  });
  it('도달 시 레벨 가격으로 체결 — 롱', () => {
    expect(sltpHit('long', 96, 95, 110)).toBeNull();
    expect(sltpHit('long', 95, 95, 110)).toEqual({ kind: 'sl', price: 95 });
    expect(sltpHit('long', 112, 95, 110)).toEqual({ kind: 'tp', price: 110 });
  });
  it('도달 시 레벨 가격으로 체결 — 숏', () => {
    expect(sltpHit('short', 104, 105, 90)).toBeNull();
    expect(sltpHit('short', 106, 105, 90)).toEqual({ kind: 'sl', price: 105 });
    expect(sltpHit('short', 88, 105, 90)).toEqual({ kind: 'tp', price: 90 });
  });
});

describe('FR-5.15b 꼬리(고가·저가) 체결', () => {
  it('롱: 저가가 손절을 스치면 체결 (종가가 위로 끝나도)', () => {
    expect(sltpWickHit('long', 94, 108, 95, 110)).toEqual({ kind: 'sl', price: 95 });
  });
  it('롱: 고가가 익절을 스치면 체결', () => {
    expect(sltpWickHit('long', 99, 111, 95, 110)).toEqual({ kind: 'tp', price: 110 });
  });
  it('숏: 방향이 반대', () => {
    expect(sltpWickHit('short', 88, 100, 105, 90)).toEqual({ kind: 'tp', price: 90 });
    expect(sltpWickHit('short', 100, 106, 105, 90)).toEqual({ kind: 'sl', price: 105 });
  });
  it('한 봉에 둘 다 걸리면 손절 우선 (순서를 알 수 없으므로 보수적으로)', () => {
    expect(sltpWickHit('long', 94, 111, 95, 110)).toEqual({ kind: 'sl', price: 95 });
  });
  it('봉이 레벨에 못 미치면 미체결', () => {
    expect(sltpWickHit('long', 96, 109, 95, 110)).toBeNull();
  });
});
