import { describe, expect, it } from 'vitest';
import { baseIncome, heatOf, judge, settle } from '../src/economy.js';

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

describe('FR-5.5 만기 판정', () => {
  it('수용 기준: AUM 2000 · 25% 투입 · WIN · M=1.0 → payout 950', () => {
    // z=1.0이 되는 가격 구성: σ=1.0, Δ=+1.0%
    const r = judge(10000, 10100, 1.0, 'long', 500, 0.6);
    expect(r.outcome).toBe('win');
    expect(r.m).toBeCloseTo(1.0);
    expect(r.payout).toBe(950); // 500 × (1 + 0.9×1.0)
  });
  it('수용 기준: L=0.90 지역 LOSE → payout = stake × 0.10', () => {
    const r = judge(10000, 10100, 1.0, 'short', 1000, 0.9);
    expect(r.outcome).toBe('lose');
    expect(r.payout).toBe(100);
  });
  it('z < 0.25 → DRAW 원금 반환', () => {
    const r = judge(10000, 10010, 1.0, 'short', 500, 0.6); // Δ=0.1% → z=0.1
    expect(r.outcome).toBe('draw');
    expect(r.payout).toBe(500);
  });
  it('M은 [0.5, 3.0]으로 클램프', () => {
    expect(judge(10000, 10001, 1.0, 'long', 100, 0.6).m).toBe(0.5);
    expect(judge(10000, 11000, 1.0, 'long', 100, 0.6).m).toBe(3.0);
  });
});

describe('FR-8 정산·등급·보상 자격', () => {
  it('수용 기준: 잔여골드율 25% · 적중률 68% · HP 95 · 적본진 미파괴 → 6점 S, 자격 3계열', () => {
    const r = settle({
      goldLeft: 250, goldEarnedTotal: 1000, aumLeft: 0, hpLeft: 95,
      wins: 17, loses: 8, enemyBaseDestroyed: false, isRetry: false, irBonus: 0,
    });
    expect(r.gradePoints).toBe(6);
    expect(r.grade).toBe('S');
    expect(r.eligibleLines.sort()).toEqual(['defense', 'finance', 'info']);
  });
  it('적중률 보너스는 상위만 적용 (0.7 이상 → +0.30, +0.15와 중복 아님)', () => {
    const hi = settle({ goldLeft: 100, goldEarnedTotal: 1000, aumLeft: 0, hpLeft: 50, wins: 7, loses: 3, enemyBaseDestroyed: false, isRetry: false, irBonus: 0 });
    // base 100 × (1+0.3) × B(1.1: 골드1점+적중2점=3점) = 143
    expect(hi.capital).toBe(Math.floor(100 * 1.3 * 1.1));
  });
  it('재도전 → 자본금 50% (FR-8.1)', () => {
    const base = { goldLeft: 400, goldEarnedTotal: 1000, aumLeft: 200, hpLeft: 100, wins: 8, loses: 2, enemyBaseDestroyed: true, isRetry: false, irBonus: 0 };
    const normal = settle(base);
    const retry = settle({ ...base, isRetry: true });
    expect(retry.capital).toBe(Math.floor(normal.capital * 0.5));
  });
  it('DRAW는 적중률 분모에서 제외', () => {
    const r = settle({ goldLeft: 0, goldEarnedTotal: 1000, aumLeft: 0, hpLeft: 10, wins: 6, loses: 4, enemyBaseDestroyed: false, isRetry: false, irBonus: 0 });
    expect(r.accuracy).toBeCloseTo(0.6);
  });
});
