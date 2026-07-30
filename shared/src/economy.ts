// 경제·판정·정산 수식 — 서버와 봇 시뮬레이터가 공유하는 순수 함수.
import { BALANCE } from './balance.js';
import type { Grade, Outcome, RewardLine } from './types.js';

// FR-6.8 기본 수입: 총액을 먼저 확정하고 분배한다 (웨이브당 내림 + 마지막 웨이브 나머지 보정)
export function baseIncome(capturedCount: number, waveCount = BALANCE.WAVE_COUNT, financeRewards = 0) {
  const upkeepPer = Math.max(0, BALANCE.UPKEEP_PER_TERRITORY - financeRewards * BALANCE.UPKEEP_FINANCE_DISCOUNT);
  const total = BALANCE.BASE_INCOME_PER_WAVE * waveCount - capturedCount * upkeepPer;
  const perWave = Math.floor(total / waveCount);
  const lastWave = total - perWave * (waveCount - 1);
  return { total, perWave, lastWave };
}

export function heatOf(capturedCount: number): number {
  return 1 + capturedCount * BALANCE.HEAT_PER_TERRITORY;
}

// FR-5.5 만기 판정
export function judge(
  basePrice: number,
  closePrice: number,
  sigma: number,
  direction: 'long' | 'short',
  stake: number,
  lossRate: number,
): { outcome: Outcome; deltaPct: number; z: number; m: number; payout: number } {
  const deltaPct = ((closePrice - basePrice) / basePrice) * 100;
  const sig = Math.max(sigma, 1e-6);
  const z = Math.abs(deltaPct) / sig;
  const m = Math.min(Math.max(z, BALANCE.M_CLAMP[0]), BALANCE.M_CLAMP[1]);
  if (z < BALANCE.DRAW_BAND) {
    return { outcome: 'draw', deltaPct, z, m, payout: stake };
  }
  const correct = direction === 'long' ? deltaPct > 0 : deltaPct < 0;
  if (correct) {
    return { outcome: 'win', deltaPct, z, m, payout: Math.floor(stake * (1 + BALANCE.PAYOUT_BASE * m)) };
  }
  return { outcome: 'lose', deltaPct, z, m, payout: Math.floor(stake * (1 - lossRate)) };
}

// FR-8.1 / FR-8.2 정산
export interface SettlementInput {
  goldLeft: number;
  goldEarnedTotal: number;
  aumLeft: number;
  hpLeft: number; // 0~100
  wins: number;
  loses: number;
  enemyBaseDestroyed: boolean;
  isRetry: boolean;
  irBonus: number; // IR팀 합연산 보너스 (0 / 0.05 / 0.10)
}

export interface SettlementResult {
  goldLeftRate: number;
  accuracy: number;
  gradePoints: number;
  grade: Grade;
  capital: number;
  eligibleLines: RewardLine[];
}

export function settle(inp: SettlementInput): SettlementResult {
  const goldLeftRate = inp.goldEarnedTotal > 0 ? inp.goldLeft / inp.goldEarnedTotal : 0;
  const denom = inp.wins + inp.loses; // DRAW 분모 제외
  const accuracy = denom > 0 ? inp.wins / denom : 0;

  // 등급 점수 (FR-8.2)
  let pts = 0;
  pts += goldLeftRate >= 0.2 ? 2 : goldLeftRate >= 0.1 ? 1 : 0;
  pts += accuracy >= 0.65 ? 2 : accuracy >= 0.55 ? 1 : 0;
  pts += inp.hpLeft >= 90 ? 2 : inp.hpLeft >= 70 ? 1 : 0;
  pts += inp.enemyBaseDestroyed ? 1 : 0;
  const grade: Grade = pts >= 6 ? 'S' : pts >= 4 ? 'A' : pts >= 2 ? 'B' : 'C';

  // 자본금 (FR-8.1) — 보너스는 전부 합연산
  const base = inp.goldLeft * 1.0 + inp.aumLeft * 0.5;
  let bonus = 1.0 + inp.irBonus;
  if (inp.hpLeft >= 100) bonus += BALANCE.BONUS_HP_FULL;
  if (accuracy >= 0.7) bonus += BALANCE.BONUS_ACC_70;
  else if (accuracy >= 0.6) bonus += BALANCE.BONUS_ACC_60;
  let capital = base * bonus * BALANCE.GRADE_MULT[grade];
  if (inp.isRetry) capital *= BALANCE.RETRY_CAPITAL_MULT;

  // 점령 보상 자격 (FR-8.3)
  const eligibleLines: RewardLine[] = [];
  if (goldLeftRate >= 0.2) eligibleLines.push('finance');
  if (accuracy >= 0.65) eligibleLines.push('info');
  if (inp.hpLeft >= 90) eligibleLines.push('defense');
  if (inp.enemyBaseDestroyed) eligibleLines.push('offense');

  return { goldLeftRate, accuracy, gradePoints: pts, grade, capital: Math.floor(capital), eligibleLines };
}
