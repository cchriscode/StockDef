// PRD §10-⑥ 봇 시뮬레이터 — 승률 p를 강제한 봇으로 지역별 클리어율을 측정해
// §9.3 설계 곡선(R1: 45%도 클리어 / R3: 50% 미만 실패 / 예측 미실시: 전멸)과 대조한다.
// 사용: npm run sim [runsPerCell]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BALANCE, Battle, WAVE_TABLES, baseIncome, heatOf, judge,
  type BarsFile, type RegionId, type StageParams,
} from '@tf/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'out', 'chart_sets.json'), 'utf-8')) as {
  id: string; region_id: string; bars_url: string;
}[];

const RUNS = Number(process.argv[2] ?? 60);
const CAPTURED: Record<string, number> = { R1: 0, R2: 1, R3: 2 }; // §9.3 전제
const barsCache = new Map<string, BarsFile>();

function loadBars(url: string): BarsFile {
  let b = barsCache.get(url);
  if (!b) {
    b = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', url.replace('/static/', 'static/')), 'utf-8')) as BarsFile;
    barsCache.set(url, b);
  }
  return b;
}

function makeParams(region: RegionId): StageParams {
  const captured = CAPTURED[region];
  const income = baseIncome(captured);
  return {
    regionId: region,
    // §9.3 전제: R1 AUM 2000 / R2 2400 / R3 2800 (데스크 업그레이드 진행 가정)
    aum: BALANCE.AUM_BY_DESK_LV[captured],
    totalBaseIncome: income.total, incomePerWave: income.perWave, incomeLastWave: income.lastWave,
    heat: heatOf(captured), lossRate: BALANCE.LOSS_RATE[region], payoutBase: BALANCE.PAYOUT_BASE,
    drawBand: BALANCE.DRAW_BAND, towerSlots: 6, maxPositions: 24, waveCount: 13,
    unitHpMult: 1, towerDmgMult: 1, unitCostMult: 1, hasInfoResearch: false,
    waveTable: WAVE_TABLES[region],
  };
}

interface RunResult { victory: boolean; goldLeft: number; positions: number; wins: number; loses: number }

/** 승률 p 봇: 실제 봉 데이터로 판정하되, 방향을 확률 p로 정답에 맞춘다 (PRD §9.1 검증 방식) */
function runStage(region: RegionId, p: number, usePositions: boolean): RunResult {
  const pool = SETS.filter((s) => s.region_id === region);
  const cs = pool[Math.floor(Math.random() * pool.length)];
  const bars = loadBars(cs.bars_url);
  const params = makeParams(region);
  const b = new Battle(params, bars.events);

  let aum = params.aum;
  let openUntil = -1; // 포지션 만기 bar
  let pending: { stake: number; dir: 'long' | 'short'; openIdx: number; closeIdx: number } | null = null;
  let positions = 0;
  let wins = 0;
  let loses = 0;
  const buildOrder: ('basic' | 'aa' | 'basic' | 'splash' | 'aa' | 'splash')[] = ['basic', 'aa', 'basic', 'splash', 'aa', 'splash'];
  let built = 0;

  for (let t = 0.5; t <= 390 + 45; t += 0.5) { // 오버타임 상한(+40) 너머까지 돌아야 done 판정에 도달
    b.advanceTo(t);
    if (b.phase === 'done') break;
    const bar = Math.floor(Math.min(t, 389));

    // 포지션 판정 (만기 도달)
    if (pending && bar >= pending.closeIdx) {
      const sigma = bars.sigma['30'];
      const r = judge(bars.bars[pending.openIdx].c, bars.bars[pending.closeIdx].c, sigma, pending.dir, pending.stake, params.lossRate);
      if (r.outcome === 'win') wins += 1;
      else if (r.outcome === 'lose') loses += 1;
      b.addGold(r.payout);
      pending = null;
    }

    // 포지션 오픈 (봇: 가능한 즉시, 25% 투입, 30봉 만기)
    if (usePositions && !pending && bar > openUntil && bar + 32 < 390 && aum >= 4 && positions < params.maxPositions) {
      const openIdx = bar + 1;
      const closeIdx = openIdx + 30;
      const actualDelta = (bars.bars[closeIdx].c - bars.bars[openIdx].c) / bars.bars[openIdx].c;
      const correctDir: 'long' | 'short' = actualDelta > 0 ? 'long' : 'short';
      const dir = Math.random() < p ? correctDir : correctDir === 'long' ? 'short' : 'long';
      const stake = Math.max(1, Math.floor(aum * 0.25));
      aum -= stake;
      pending = { stake, dir, openIdx, closeIdx };
      positions += 1;
      openUntil = closeIdx + 2;
    }

    // 전투 지출 (그리디) — 3번 슬롯 기본 포탑은 강적 타겟팅(힐러·탱커 저격, 평균적 카운터 플레이 반영)
    if (built < buildOrder.length) {
      if (b.buildTower(built, buildOrder[built])) {
        if (built === 2) { b.cycleTargeting(2); b.cycleTargeting(2); } // first → last → strong
        built += 1;
      }
    } else {
      for (let s = 0; s < 6; s++) if (b.gold >= 400) b.upgradeTower(s);
      if (b.gold >= 320) b.spawnUnit('trader');
      else if (b.gold >= 220) b.spawnUnit('analyst');
    }
    if (b.enemies.filter((e) => !e.air).length >= 6 && b.gold >= 380) b.useSkill();
  }
  return { victory: b.victory, goldLeft: Math.floor(b.gold), positions, wins, loses };
}

console.log(`봇 시뮬레이터 — 지역×승률 셀당 ${RUNS}회\n`);
const pList = [0.45, 0.5, 0.55, 0.6, 0.65];
console.log('지역  | ' + pList.map((p) => `p=${(p * 100).toFixed(0)}%`.padStart(14)).join(' | ') + ' | 예측 미실시');
for (const region of ['R1', 'R2', 'R3'] as RegionId[]) {
  const cells = pList.map((p) => {
    let clear = 0;
    let goldSum = 0;
    for (let i = 0; i < RUNS; i++) {
      const r = runStage(region, p, true);
      if (r.victory) clear += 1;
      goldSum += r.goldLeft;
    }
    return `${((clear / RUNS) * 100).toFixed(0)}% 클리어/${Math.round(goldSum / RUNS)}G`.padStart(14);
  });
  let noPos = 0;
  for (let i = 0; i < RUNS; i++) if (runStage(region, 0, false).victory) noPos += 1;
  console.log(`${region}    | ${cells.join(' | ')} | ${((noPos / RUNS) * 100).toFixed(0)}% 클리어`);
}
console.log('\n설계 목표(§9.3): R1은 저승률도 클리어 가능 / R3는 p<50% 실패 / 예측 미실시는 전 지역 클리어 불가');
