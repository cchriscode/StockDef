// 스테이지 진입 시점 파라미터 스냅샷 (PRD stage_sessions.params — 중간 업글 영향 차단)
import {
  BALANCE, DEPT_EFFECTS, WAVE_TABLES, baseIncome, heatOf,
  type DeptKey, type RegionId, type StageMode, type StageParams,
} from '@tf/shared';
import { db, type TerritoryRow } from './db.js';

export function getDeptLevels(accountId: string): Record<DeptKey, number> {
  const rows = db.prepare('SELECT dept_key, level FROM departments WHERE account_id = ?').all(accountId) as { dept_key: DeptKey; level: number }[];
  const out = { trading_desk: 1, rnd: 1, hr: 1, legal: 1, ir: 1, margin: 1, research: 1, facility: 1 } as Record<DeptKey, number>;
  for (const r of rows) out[r.dept_key] = r.level;
  return out;
}

export function getTerritories(accountId: string): TerritoryRow[] {
  return db.prepare('SELECT * FROM territories WHERE account_id = ?').all(accountId) as TerritoryRow[];
}

export function countRewards(territories: TerritoryRow[], line: string): number {
  return territories.filter((t) => (JSON.parse(t.rewards_taken) as string[]).includes(line)).length;
}

export function buildStageParams(accountId: string, regionId: RegionId, mode: StageMode = 'hard'): StageParams {
  const depts = getDeptLevels(accountId);
  const territories = getTerritories(accountId);
  const captured = territories.filter((t) => t.captured_at && t.region_id !== 'TUT').length;

  const financeRewards = countRewards(territories, 'finance');
  const defenseRewards = countRewards(territories, 'defense');
  const offenseRewards = countRewards(territories, 'offense');
  const infoRewards = countRewards(territories, 'info');

  const waveCount = regionId === 'TUT' ? BALANCE.TUTORIAL_WAVES : BALANCE.WAVE_COUNT;
  const income = baseIncome(regionId === 'TUT' ? 0 : captured, waveCount, financeRewards);
  const lossRate = Math.max(0.1, BALANCE.LOSS_RATE[regionId] - DEPT_EFFECTS.legalCut(depts.legal));

  return {
    regionId,
    aum: BALANCE.AUM_BY_DESK_LV[depts.trading_desk - 1],
    totalBaseIncome: income.total,
    incomePerWave: income.perWave,
    incomeLastWave: income.lastWave,
    heat: regionId === 'TUT' ? 1 : heatOf(captured),
    lossRate: Math.round(lossRate * 100) / 100,
    maxLossRate: BALANCE.MAX_LOSS_RATE,
    maxLeverage: regionId === 'TUT' ? 1 : DEPT_EFFECTS.maxLeverage(depts.margin),
    mode,
    // FR-2.6 이지모드는 하드 기준값에 완화 계수를 곱한다
    enemyHpMult: BALANCE.ENEMY_HP_MULT * (mode === 'easy' ? BALANCE.EASY_HP_MULT : 1),
    enemyDpsMult: BALANCE.ENEMY_DPS_MULT * (mode === 'easy' ? BALANCE.EASY_DPS_MULT : 1),
    enemyCountMult: mode === 'easy' ? BALANCE.EASY_COUNT_MULT : 1,
    payoutBase: BALANCE.PAYOUT_BASE,
    drawBand: BALANCE.DRAW_BAND,
    // FR-6.4e 사옥 2칸 + 시설팀이 여는 지면 칸 + 점령(방어 계열) 보상
    towerSlots: Math.min(BALANCE.BASE_TOWER_SLOTS + DEPT_EFFECTS.groundSlots(depts.facility) + defenseRewards, BALANCE.TOWER_SLOTS_MAX),
    // FR-5.13b 거래 횟수는 웨이브마다 +2로 열린다. maxPositions는 스테이지 전체 상한(표시·검증용).
    tradeBonus: DEPT_EFFECTS.maxPositions(depts.research) - BALANCE.MAX_POSITIONS, // 리서치 데스크 여유분
    maxPositions: waveCount * BALANCE.TRADES_PER_WAVE + (DEPT_EFFECTS.maxPositions(depts.research) - BALANCE.MAX_POSITIONS),
    waveCount,
    unitHpMult: DEPT_EFFECTS.unitHpMult(depts.hr),
    towerDmgMult: DEPT_EFFECTS.towerDmgMult(depts.rnd),
    unitCostMult: Math.max(0.55, 1 - offenseRewards * BALANCE.REWARD_OFFENSE_COST_CUT),
    hasInfoResearch: infoRewards > 0,
    waveTable: WAVE_TABLES[regionId],
  };
}
