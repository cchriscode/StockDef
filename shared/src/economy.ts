// 경제·판정·정산 수식 — 서버와 봇 시뮬레이터가 공유하는 순수 함수.
import { BALANCE } from './balance.js';
import type { Grade, Outcome, RewardLine, StageMode } from './types.js';

// FR-6.8 기본 수입: 총액을 먼저 확정하고 분배한다 (웨이브당 내림 + 마지막 웨이브 나머지 보정)
export function baseIncome(capturedCount: number, waveCount: number = BALANCE.WAVE_COUNT, financeRewards = 0) {
  const upkeepPer = Math.max(0, BALANCE.UPKEEP_PER_TERRITORY - financeRewards * BALANCE.UPKEEP_FINANCE_DISCOUNT);
  const total = BALANCE.BASE_INCOME_PER_WAVE * waveCount - capturedCount * upkeepPer;
  const perWave = Math.floor(total / waveCount);
  const lastWave = total - perWave * (waveCount - 1);
  return { total, perWave, lastWave };
}

export function heatOf(capturedCount: number): number {
  return 1 + capturedCount * BALANCE.HEAT_PER_TERRITORY;
}

// FR-5.5 청산 손익 수식 (선물식 연속 PnL, 비대칭 계수)
// g = 방향 × (Δ%/σ30) × 배율 — 부호 있는 정규화 수익.
// 상방은 B×g (전 지역 0.9), 하방은 L×g (지역 난이도 노브) — 손실은 stake×MAX_LOSS_RATE에서 클램프.
// outcome은 실현 손익 부호 기준 (2026-08-05 개정: DRAW_BAND 폐지 — pnl>0 승 / pnl<0 패 / pnl=0 무).
export function judge(
  basePrice: number,
  closePrice: number,
  sigma: number,
  direction: 'long' | 'short',
  stake: number,
  lossRate: number,
  leverage = 1, // FR-5.6b: 배율은 g에 곱해 양방향 증폭 — 손실은 여전히 MAX_LOSS_RATE에서 클램프 (강제 청산 상한)
): { outcome: Outcome; deltaPct: number; g: number; payout: number; pnl: number } {
  const deltaPct = ((closePrice - basePrice) / basePrice) * 100;
  const sig = Math.max(sigma, 1e-6);
  const g = (direction === 'long' ? 1 : -1) * (deltaPct / sig) * leverage;
  const raw = g >= 0 ? BALANCE.PAYOUT_BASE * g : lossRate * g;
  const capped = Math.min(Math.max(raw, -BALANCE.MAX_LOSS_RATE), BALANCE.PAYOUT_BASE * BALANCE.Z_CAP);
  // 1e-6 가드: 부동소수점 오차로 정수 경계가 내려앉는 것 방지 (예: 1000×0.1 = 99.999…)
  const payout = Math.max(0, Math.floor(stake * (1 + capped) + 1e-6));
  const pnl = payout - stake;
  const outcome: Outcome = pnl > 0 ? 'win' : pnl < 0 ? 'lose' : 'draw';
  return { outcome, deltaPct, g, payout, pnl };
}

/**
 * FR-5.14 거래 수수료 — 명목가 × FEE_RATE, 진입·청산 각각 1회. 최소 1 (0으로 반올림되면 존재감이 없다).
 * 청산 수수료도 진입 명목가로 계산한다 — 진입 시점에 왕복 비용을 확정해 보여줄 수 있어야 하기 때문.
 */
export function tradeFee(stake: number, leverage = 1): number {
  return Math.max(1, Math.round(stake * leverage * BALANCE.FEE_RATE));
}

/**
 * FR-5.15 손절/익절 도달 판정 — 방향별로 어느 쪽을 넘어야 체결인지 결정한다.
 * 반환값이 있으면 그 가격에 체결한다 (레벨 자체로 체결 — 봉 해상도가 1초라 슬리피지를 만들지 않는다).
 */
export function sltpHit(
  direction: 'long' | 'short',
  price: number,
  sl: number | null,
  tp: number | null,
): { kind: 'sl' | 'tp'; price: number } | null {
  if (direction === 'long') {
    if (sl != null && price <= sl) return { kind: 'sl', price: sl };
    if (tp != null && price >= tp) return { kind: 'tp', price: tp };
  } else {
    if (sl != null && price >= sl) return { kind: 'sl', price: sl };
    if (tp != null && price <= tp) return { kind: 'tp', price: tp };
  }
  return null;
}

/** 손절/익절 레벨이 방향상 올바른 쪽에 있는지 (롱: 손절 < 진입 < 익절) */
export function sltpValid(direction: 'long' | 'short', basePrice: number, sl: number | null, tp: number | null): boolean {
  if (sl != null && (!Number.isFinite(sl) || sl <= 0)) return false;
  if (tp != null && (!Number.isFinite(tp) || tp <= 0)) return false;
  if (direction === 'long') {
    if (sl != null && sl >= basePrice) return false;
    if (tp != null && tp <= basePrice) return false;
  } else {
    if (sl != null && sl <= basePrice) return false;
    if (tp != null && tp >= basePrice) return false;
  }
  return true;
}

/**
 * FR-5.5b/5.5c 청산 분해 — 스테이크(−손실)는 AUM 반환, 순수익은 **GOLD_PER_TRADE_CAP까지만** 골드로
 * 환전하고 초과분은 AUM에 쌓인다 (한 방 대박이 전투 경제를 무너뜨리지 않도록).
 */
export function splitPayout(payout: number, stake: number): { returnToAum: number; goldGain: number } {
  const profit = Math.max(0, payout - stake);
  const goldGain = Math.min(profit, BALANCE.GOLD_PER_TRADE_CAP);
  return { returnToAum: payout - goldGain, goldGain };
}

// FR-5.12 마진콜 강제청산 — 손실률이 MAX_LOSS_RATE에 도달하는 진입 대비 Δ% (부호 = 손실 방향)
export function liquidationDeltaPct(sigma: number, lossRate: number, leverage: number, direction: 'long' | 'short'): number {
  const mag = (BALANCE.MAX_LOSS_RATE / (lossRate * Math.max(leverage, 1))) * Math.max(sigma, 1e-6);
  return direction === 'long' ? -mag : mag;
}

// FR-8.1 / FR-8.2 정산
export interface SettlementInput {
  goldLeft: number;
  goldEarnedTotal: number;
  aumLeft: number;
  aumInitial: number; // 초기 AUM — 자본금은 초과분(운용 성과)만 인정 (스테이크 반환 구조에서 원금 이중 보상 방지)
  hpLeft: number; // 0~100
  wins: number;
  loses: number;
  enemyBaseDestroyed: boolean;
  isRetry: boolean;
  irBonus: number; // IR팀 합연산 보너스 (0 / 0.05 / 0.10)
  mode?: StageMode; // FR-2.6 이지모드는 자본금 보상 축소
}

export interface SettlementResult {
  aumLeftRate: number; // 잔여 AUM ÷ 초기 AUM (운용 성과)
  accuracy: number;
  gradePoints: number;
  grade: Grade;
  capital: number;
  eligibleLines: RewardLine[];
}

export function settle(inp: SettlementInput): SettlementResult {
  // FR-8.2 개정(2026-08-10): 등급 기준을 잔여 골드 → **잔여 AUM(운용 성과)**로 전환.
  // 골드는 방어에 쓰라고 주는 자원이라 '안 쓰고 남기면 고득점'이 소극적 플레이를 보상했다.
  // AUM은 트레이딩 원금이므로 '원금을 지켰나 / 불렸나'가 곧 실력이 된다.
  const aumLeftRate = inp.aumInitial > 0 ? inp.aumLeft / inp.aumInitial : 0;
  const denom = inp.wins + inp.loses; // DRAW 분모 제외
  const accuracy = denom > 0 ? inp.wins / denom : 0;

  // 등급 점수 (FR-8.2)
  let pts = 0;
  pts += aumLeftRate >= 1.15 ? 2 : aumLeftRate >= 1.0 ? 1 : 0; // 원금 대비 +15% / 원금 보전
  pts += accuracy >= 0.65 ? 2 : accuracy >= 0.55 ? 1 : 0;
  pts += inp.hpLeft >= 90 ? 2 : inp.hpLeft >= 70 ? 1 : 0;
  pts += inp.enemyBaseDestroyed ? 1 : 0;
  const grade: Grade = pts >= 6 ? 'S' : pts >= 4 ? 'A' : pts >= 2 ? 'B' : 'C';

  // 자본금 (FR-8.1) — 보너스는 전부 합연산. AUM은 초기치 초과분만 (원금은 데스크 자산이지 스테이지 수익이 아님)
  const base = inp.goldLeft * 1.0 + Math.max(0, inp.aumLeft - inp.aumInitial) * 0.5;
  let bonus = 1.0 + inp.irBonus;
  if (inp.hpLeft >= 100) bonus += BALANCE.BONUS_HP_FULL;
  if (accuracy >= 0.7) bonus += BALANCE.BONUS_ACC_70;
  else if (accuracy >= 0.6) bonus += BALANCE.BONUS_ACC_60;
  let capital = base * bonus * BALANCE.GRADE_MULT[grade];
  if (inp.isRetry) capital *= BALANCE.RETRY_CAPITAL_MULT;
  if (inp.mode === 'easy') capital *= BALANCE.EASY_CAPITAL_MULT; // FR-2.6

  // 점령 보상 자격 (FR-8.3)
  const eligibleLines: RewardLine[] = [];
  if (aumLeftRate >= 1.15) eligibleLines.push('finance'); // 재무 계열 = 운용 성과 기준
  if (accuracy >= 0.65) eligibleLines.push('info');
  if (inp.hpLeft >= 90) eligibleLines.push('defense');
  if (inp.enemyBaseDestroyed) eligibleLines.push('offense');

  return { aumLeftRate, accuracy, gradePoints: pts, grade, capital: Math.floor(capital), eligibleLines };
}
