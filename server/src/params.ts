// 스테이지 진입 시점 파라미터 스냅샷 (PRD stage_sessions.params — 중간 업글 영향 차단)
import {
  BALANCE, DEPT_EFFECTS, WAVE_TABLES, baseIncome, heatOf,
  type DeptKey, type RegionId, type StageParams,
} from '@tf/shared';
import { db, type TerritoryRow } from './db.js';

export function getDeptLevels(accountId: string): Record<DeptKey, number> {
  const rows = db.prepare('SELECT dept_key, level FROM departments WHERE account_id = ?').all(accountId) as { dept_key: DeptKey; level: number }[];
  const out = { trading_desk: 1, rnd: 1, hr: 1, legal: 1, ir: 1 } as Record<DeptKey, number>;
  for (const r of rows) out[r.dept_key] = r.level;
  return out;
}

export function getTerritories(accountId: string): TerritoryRow[] {
  return db.prepare('SELECT * FROM territories WHERE account_id = ?').all(accountId) as TerritoryRow[];
}

export function countRewards(territories: TerritoryRow[], line: string): number {
  return territories.filter((t) => (JSON.parse(t.rewards_taken) as string[]).includes(line)).length;
}

export function buildStageParams(accountId: string, regionId: RegionId): StageParams {
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
    aum: BALANCE.AUM_BY_DESK_LV[depts.trading_desk - 1],
    totalBaseIncome: income.total,
    incomePerWave: income.perWave,
    incomeLastWave: income.lastWave,
    heat: regionId === 'TUT' ? 1 : heatOf(captured),
    lossRate: Math.round(lossRate * 100) / 100,
    payoutBase: BALANCE.PAYOUT_BASE,
    drawBand: BALANCE.DRAW_BAND,
    towerSlots: Math.min(BALANCE.TOWER_SLOTS_BASE + defenseRewards, BALANCE.TOWER_SLOTS_MAX),
    maxPositions: BALANCE.MAX_POSITIONS,
    waveCount,
    unitHpMult: DEPT_EFFECTS.unitHpMult(depts.hr),
    towerDmgMult: DEPT_EFFECTS.towerDmgMult(depts.rnd),
    unitCostMult: Math.max(0.55, 1 - offenseRewards * BALANCE.REWARD_OFFENSE_COST_CUT),
    hasInfoResearch: infoRewards > 0,
    waveTable: WAVE_TABLES[regionId],
  };
}
