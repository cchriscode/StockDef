// 경제·판정·정산 수식 — 서버와 봇 시뮬레이터가 공유하는 순수 함수.
import { BALANCE } from './balance.js';
import type { Grade, Outcome, RewardLine } from './types.js';

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
// g = 방향 × (Δ%/σ30) — 부호 있는 정규화 수익.
// 상방은 B×g (전 지역 0.9), 하방은 L×g (지역 난이도 노브) — 손실은 stake×MAX_LOSS_RATE에서 클램프.
// outcome은 통계·등급용 분류일 뿐이며 손익은 연속이다 (|g| < DRAW_BAND → draw).
export function judge(
  basePrice: number,
  closePrice: number,
  sigma: number,
  direction: 'long' | 'short',
  stake: number,
  lossRate: number,
): { outcome: Outcome; deltaPct: number; g: number; payout: number; pnl: number } {
  const deltaPct = ((closePrice - basePrice) / basePrice) * 100;
  const sig = Math.max(sigma, 1e-6);
  const g = (direction === 'long' ? 1 : -1) * (deltaPct / sig);
  const raw = g >= 0 ? BALANCE.PAYOUT_BASE * g : lossRate * g;
  const capped = Math.min(Math.max(raw, -BALANCE.MAX_LOSS_RATE), BALANCE.PAYOUT_BASE * BALANCE.Z_CAP);
  // 1e-6 가드: 부동소수점 오차로 정수 경계가 내려앉는 것 방지 (예: 1000×0.1 = 99.999…)
  const payout = Math.max(0, Math.floor(stake * (1 + capped) + 1e-6));
  const outcome: Outcome = Math.abs(g) < BALANCE.DRAW_BAND ? 'draw' : g > 0 ? 'win' : 'lose';
  return { outcome, deltaPct, g, payout, pnl: payout - stake };
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

  // 자본금 (FR-8.1) — 보너스는 전부 합연산. AUM은 초기치 초과분만 (원금은 데스크 자산이지 스테이지 수익이 아님)
  const base = inp.goldLeft * 1.0 + Math.max(0, inp.aumLeft - inp.aumInitial) * 0.5;
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
