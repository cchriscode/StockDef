import crypto from 'node:crypto';
import { Router } from 'express';
import {
  BALANCE, DEPTS, DEPT_EFFECTS, REGION_META, settle,
  type FinishReq, type FinishRes, type Grade, type MapRegion, type MapRes,
  type RegionId, type RewardLine, type StageStartRes,
} from '@tf/shared';
import { authMiddleware, issueToken, type AuthedRequest } from './auth.js';
import { db, type ChartSetRow, type SessionRow, type TerritoryRow } from './db.js';
import { dropLive, getLive, loadLive } from './live.js';
import { buildStageParams, countRewards, getDeptLevels, getTerritories } from './params.js';

export const router = Router();

const REGIONS: RegionId[] = ['R1', 'R2', 'R3'];

// ─── FR-1 익명 계정 ───
router.post('/auth/anon', (_req, res) => {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO accounts (id) VALUES (?)').run(id);
  const insDept = db.prepare('INSERT INTO departments (account_id, dept_key, level) VALUES (?, ?, 1)');
  for (const d of DEPTS) insDept.run(id, d.key);
  res.json({ accountId: id, token: issueToken(id) });
});

router.use(authMiddleware);

function territoryOf(accountId: string, regionId: string): TerritoryRow | undefined {
  return db.prepare('SELECT * FROM territories WHERE account_id = ? AND region_id = ?').get(accountId, regionId) as TerritoryRow | undefined;
}

function regionState(accountId: string, regionId: RegionId, territories: TerritoryRow[], tutorialDone: boolean): MapRegion {
  const t = territories.find((x) => x.region_id === regionId);
  const meta = REGION_META[regionId];
  let state: MapRegion['state'] = 'locked';
  if (t?.captured_at) state = 'captured';
  else if (regionId === 'R1') state = 'open'; // FR-12.4: 튜토리얼 스킵 가능 → R1은 시작점으로 항상 개방
  else {
    const adj = territories.find((x) => x.region_id === meta.adjacent);
    if (adj?.captured_at) state = 'open';
  }
  return {
    regionId, name: meta.name, sector: meta.sector, difficulty: meta.difficulty,
    state,
    rewardsTaken: t ? (JSON.parse(t.rewards_taken) as RewardLine[]) : [],
    bestGrade: (t?.best_grade as Grade | null) ?? null,
  };
}

function accountRow(accountId: string) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as { id: string; capital: number; tutorial_done: number };
}

// ─── FR-1.2 진행도 ───
router.get('/me', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const acc = accountRow(accountId);
  const territories = getTerritories(accountId);
  const codexCount = (db.prepare('SELECT COUNT(*) AS n FROM codex_entries WHERE account_id = ?').get(accountId) as { n: number }).n;
  res.json({
    accountId,
    capital: acc.capital,
    depts: getDeptLevels(accountId),
    territories: REGIONS.map((r) => regionState(accountId, r, territories, acc.tutorial_done === 1)),
    codexCount,
    tutorialDone: acc.tutorial_done === 1,
  });
});

// ─── FR-2 지도 ───
router.get('/map', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const acc = accountRow(accountId);
  const territories = getTerritories(accountId);
  const captured = territories.filter((t) => t.captured_at && t.region_id !== 'TUT').length;
  const financeRewards = countRewards(territories, 'finance');
  const upkeepPer = Math.max(0, BALANCE.UPKEEP_PER_TERRITORY - financeRewards * BALANCE.UPKEEP_FINANCE_DISCOUNT);
  const out: MapRes = {
    regions: REGIONS.map((r) => regionState(accountId, r, territories, acc.tutorial_done === 1)),
    capital: acc.capital,
    capturedCount: captured,
    upkeepTotal: captured * upkeepPer,
    heat: 1 + captured * BALANCE.HEAT_PER_TERRITORY,
    tutorialDone: acc.tutorial_done === 1,
  };
  res.json(out);
});

// ─── FR-3.6 조합 배정 (쿨다운) + 세션 생성 ───
router.post('/stage/start', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const { regionId, speed } = req.body as { regionId: RegionId; speed?: number };
  const spd = speed ?? 1;
  if (![0.5, 1, 2].includes(spd)) return res.status(400).json({ error: 'BAD_SPEED' });
  if (!['R1', 'R2', 'R3', 'TUT'].includes(regionId)) return res.status(400).json({ error: 'BAD_REGION' });

  const acc = accountRow(accountId);
  const territories = getTerritories(accountId);
  if (regionId !== 'TUT') {
    const st = regionState(accountId, regionId, territories, acc.tutorial_done === 1);
    if (st.state === 'locked') return res.status(403).json({ error: 'REGION_LOCKED', message: '인접 지역을 먼저 점령하세요' });
  }

  // 진행 중 세션이 있으면 이탈 처리 (FR-6.11)
  const active = db.prepare("SELECT id FROM stage_sessions WHERE account_id = ? AND status = 'active'").all(accountId) as { id: string }[];
  for (const a of active) {
    dropLive(a.id);
    db.prepare("UPDATE stage_sessions SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?").run(a.id);
  }

  // 최근 N회 플레이한 조합 제외 (FR-3.6)
  const recent = db.prepare(
    'SELECT chart_set_id FROM stage_sessions WHERE account_id = ? ORDER BY started_at DESC LIMIT ?',
  ).all(accountId, BALANCE.COOLDOWN_PLAYS) as { chart_set_id: string }[];
  const excluded = new Set(recent.map((r) => r.chart_set_id));

  const pool = (db.prepare('SELECT * FROM chart_sets WHERE region_id = ?').all(regionId) as ChartSetRow[])
    .filter((c) => !excluded.has(c.id) || regionId === 'TUT');
  if (pool.length === 0) return res.status(409).json({ error: 'NO_CHART_AVAILABLE' });

  // 첫 플레이는 쉬운 조합 우선 (P1 이탈 방지 — §9.3 설계 의도)
  const territory = territoryOf(accountId, regionId);
  const firstPlay = !territory || territory.play_count === 0;
  const candidates = firstPlay ? (pool.filter((c) => c.difficulty <= 1).length ? pool.filter((c) => c.difficulty <= 1) : pool) : pool;
  // FR-3.6b: 지역별 아키타입 가중 추첨 — 쉬운 지역 박스권 / 어려운 지역 원웨이·급변
  const weights = BALANCE.ARCHETYPE_WEIGHTS[regionId] ?? {};
  const wsum = candidates.reduce((s, c) => s + (weights[c.archetype] ?? 1), 0);
  let roll = Math.random() * wsum;
  let chart = candidates[candidates.length - 1];
  for (const c of candidates) {
    roll -= weights[c.archetype] ?? 1;
    if (roll <= 0) { chart = c; break; }
  }

  const params = buildStageParams(accountId, regionId);
  const sessionId = crypto.randomUUID();
  const isRetry = !!territory?.captured_at;
  db.prepare(
    `INSERT INTO stage_sessions (id, account_id, region_id, chart_set_id, is_retry, status, speed, params)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(sessionId, accountId, regionId, chart.id, isRetry ? 1 : 0, spd, JSON.stringify(params));
  if (!territory) {
    db.prepare('INSERT INTO territories (account_id, region_id) VALUES (?, ?)').run(accountId, regionId);
  }
  loadLive(sessionId);

  // FR-4.4: chartSetId·종목·날짜는 응답에 포함하지 않는다
  const out: StageStartRes = { sessionId, barsUrl: chart.bars_url, params };
  res.json(out);
});

// ─── FR-8 정산 (§11 서버 독립 재계산 검증) ───
router.post('/stage/finish', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const { sessionId, goldLeft, goldSpent, hpLeft, enemyBaseDestroyed } = req.body as FinishReq & { sessionId: string };
  const row = db.prepare('SELECT * FROM stage_sessions WHERE id = ? AND account_id = ?').get(sessionId, accountId) as SessionRow | undefined;
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  if (row.status !== 'active') return res.status(409).json({ error: 'ALREADY_ENDED' });
  const live = getLive(sessionId) ?? loadLive(sessionId);
  if (!live || live.t0 == null) return res.status(409).json({ error: 'NOT_STARTED' });

  live.teardown();
  const params = live.params;
  const stageMs = params.waveCount * BALANCE.CYCLE_SECONDS * live.barMs;
  const elapsed = Date.now() - live.t0;
  const cleared = hpLeft > 0;

  // 클리어 주장인데 시간이 안 됐으면 무효 (시간 조작 방지).
  // FR-6.10 조기 승리(적 본진 파괴)는 러시로 매우 이르게 끝날 수 있다 — 실측상 스테이지의 ~24%도 가능.
  // 최소 10%(웨이브 1~2 진행분)만 요구해 즉시 클리어 조작만 차단한다.
  if (cleared && elapsed < stageMs * (enemyBaseDestroyed ? 0.1 : 0.95)) {
    db.prepare("UPDATE stage_sessions SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?").run(sessionId);
    dropLive(sessionId);
    return res.json({ status: 'invalid', grade: null, accuracy: 0, returnPct: 0, goldLeftRate: 0, capitalAwarded: 0, eligibleLines: [], alreadyOwnedLines: [], isRetry: !!row.is_retry, capitalTotal: accountRow(accountId).capital } satisfies FinishRes);
  }

  // 골드 독립 재계산 검증 (§11): 총 획득 = 기본 수입(시계 기준) + 골드 환전 순수익 합 (FR-5.5b)
  // 조기 승리(FR-6.10) 시엔 시작된 웨이브까지만 수입이 지급되므로 항상 시계 기준으로 계산한다.
  const barIdxAtEnd = live.serverBarIdx();
  const serverEarned = live.incomeSoFar(barIdxAtEnd) + live.goldSum;
  const claimed = Math.round(goldLeft + goldSpent);
  const tolerance = Math.max(serverEarned * 0.05, 15);
  const valid = Math.abs(claimed - serverEarned) <= tolerance && goldLeft >= 0 && goldSpent >= 0;
  if (!valid) {
    db.prepare("UPDATE stage_sessions SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?").run(sessionId);
    dropLive(sessionId);
    return res.json({ status: 'invalid', grade: null, accuracy: 0, returnPct: 0, goldLeftRate: 0, capitalAwarded: 0, eligibleLines: [], alreadyOwnedLines: [], isRetry: !!row.is_retry, capitalTotal: accountRow(accountId).capital } satisfies FinishRes);
  }

  const depts = getDeptLevels(accountId);
  const s = settle({
    goldLeft: Math.round(goldLeft),
    goldEarnedTotal: serverEarned,
    aumLeft: live.aum,
    aumInitial: params.aum,
    hpLeft,
    wins: live.wins,
    loses: live.loses,
    enemyBaseDestroyed,
    isRetry: !!row.is_retry,
    irBonus: DEPT_EFFECTS.irBonus(depts.ir),
  });

  const isTut = row.region_id === 'TUT';
  // FR-6.9 패배: 자본금 0 / FR-12.5 튜토리얼: 고정 500
  const capitalAwarded = !cleared ? 0 : isTut ? BALANCE.TUTORIAL_CAPITAL : s.capital;
  const status = cleared ? 'cleared' : 'failed';

  const territory = territoryOf(accountId, row.region_id)!;
  const owned = JSON.parse(territory.rewards_taken) as RewardLine[];
  const eligible = cleared && !isTut ? s.eligibleLines : [];
  const selectable = eligible.filter((l) => !owned.includes(l));

  db.prepare(
    `UPDATE stage_sessions SET status = ?, ended_at = datetime('now'), gold_earned = ?, gold_left = ?, aum_left = ?,
     hp_left = ?, hits = ?, misses = ?, draws = ?, enemy_base_destroyed = ?, grade = ?, capital_awarded = ?, eligible_lines = ?
     WHERE id = ?`,
  ).run(status, serverEarned, Math.round(goldLeft), live.aum, hpLeft, live.wins, live.loses, live.draws,
    enemyBaseDestroyed ? 1 : 0, cleared ? s.grade : null, capitalAwarded, JSON.stringify(selectable), sessionId);

  db.prepare('UPDATE accounts SET capital = capital + ? WHERE id = ?').run(capitalAwarded, accountId);
  const gradeRank = { S: 4, A: 3, B: 2, C: 1 } as Record<string, number>;
  const bestGrade = cleared && (!territory.best_grade || gradeRank[s.grade] > gradeRank[territory.best_grade]) ? s.grade : territory.best_grade;
  db.prepare(
    `UPDATE territories SET play_count = play_count + 1, captured_at = COALESCE(captured_at, ?), best_grade = ? WHERE account_id = ? AND region_id = ?`,
  ).run(cleared ? new Date().toISOString() : null, bestGrade, accountId, row.region_id);

  if (isTut && cleared) db.prepare('UPDATE accounts SET tutorial_done = 1 WHERE id = ?').run(accountId);

  // FR-10.1 도감 등록 (클리어만, 튜토리얼 제외)
  if (cleared && !isTut) {
    db.prepare(
      `INSERT INTO codex_entries (account_id, chart_set_id, best_accuracy, best_grade) VALUES (?, ?, ?, ?)
       ON CONFLICT (account_id, chart_set_id) DO UPDATE SET
         best_accuracy = MAX(best_accuracy, excluded.best_accuracy),
         best_grade = CASE WHEN excluded.best_grade < best_grade THEN excluded.best_grade ELSE best_grade END`,
    ).run(accountId, row.chart_set_id, s.accuracy, s.grade);
  }

  dropLive(sessionId);
  const returnPct = live.stakeSum > 0 ? Math.round(((live.payoutSum - live.stakeSum) / live.stakeSum) * 1000) / 1000 : 0;
  const out: FinishRes = {
    status, grade: cleared ? s.grade : null, accuracy: s.accuracy, returnPct, goldLeftRate: s.goldLeftRate,
    capitalAwarded, eligibleLines: selectable, alreadyOwnedLines: eligible.filter((l) => owned.includes(l)),
    isRetry: !!row.is_retry, capitalTotal: accountRow(accountId).capital,
  };
  res.json(out);
});

// ─── FR-9.3 공개 정보 (정산 후 별도 API — FR-4.4 준수) ───
router.get('/stage/:id/reveal', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const row = db.prepare('SELECT * FROM stage_sessions WHERE id = ? AND account_id = ?').get(req.params.id, accountId) as SessionRow | undefined;
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  if (row.status === 'active') return res.status(403).json({ error: 'STAGE_NOT_ENDED' });
  const cs = db.prepare('SELECT * FROM chart_sets WHERE id = ?').get(row.chart_set_id) as ChartSetRow;
  const positions = db.prepare(
    'SELECT seq, direction, stake, open_bar_idx, close_bar_idx, outcome, payout FROM positions WHERE session_id = ? ORDER BY seq',
  ).all(row.id) as { seq: number; direction: string; stake: number; open_bar_idx: number; close_bar_idx: number; outcome: string; payout: number }[];
  const ohlcv = JSON.parse(cs.ohlcv_day) as { around: unknown[]; dayIndex: number; windowLen?: number; dateStart?: string };
  res.json({
    ticker: cs.ticker, companyName: cs.company_name, tradeDate: cs.trade_date, tradeStart: ohlcv.dateStart,
    sector: cs.sector, dayChangePct: cs.day_change_pct, rarity: cs.rarity,
    news: JSON.parse(cs.news),
    dailyAround: ohlcv.around, dayIndex: ohlcv.dayIndex, windowLen: ohlcv.windowLen ?? 0,
    positions: positions.map((p) => ({
      seq: p.seq, direction: p.direction, stake: p.stake,
      openBarIdx: p.open_bar_idx, closeBarIdx: p.close_bar_idx, outcome: p.outcome, payout: p.payout,
    })),
    hits: row.hits ?? 0, misses: row.misses ?? 0, status: row.status,
  });
});

// ─── FR-8.4 점령 보상 선택 ───
router.post('/stage/:id/reward', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const { line } = req.body as { line: RewardLine };
  const row = db.prepare('SELECT * FROM stage_sessions WHERE id = ? AND account_id = ?').get(req.params.id, accountId) as SessionRow | undefined;
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  if (row.status !== 'cleared') return res.status(403).json({ error: 'NOT_CLEARED' });
  if (row.reward_taken) return res.status(409).json({ error: 'ALREADY_PICKED' });
  const eligible = JSON.parse(row.eligible_lines ?? '[]') as RewardLine[];
  if (!eligible.includes(line)) return res.status(400).json({ error: 'NOT_ELIGIBLE' });
  const territory = territoryOf(accountId, row.region_id)!;
  const owned = JSON.parse(territory.rewards_taken) as RewardLine[];
  if (owned.includes(line)) return res.status(409).json({ error: 'ALREADY_OWNED' });
  owned.push(line);
  db.prepare('UPDATE territories SET rewards_taken = ? WHERE account_id = ? AND region_id = ?').run(JSON.stringify(owned), accountId, row.region_id);
  db.prepare('UPDATE stage_sessions SET reward_taken = ? WHERE id = ?').run(line, row.id);
  res.json({ ok: true, rewardsTaken: owned });
});

// ─── FR-11 부서 업그레이드 ───
router.post('/dept/upgrade', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const { deptKey } = req.body as { deptKey: string };
  const spec = DEPTS.find((d) => d.key === deptKey);
  if (!spec) return res.status(400).json({ error: 'BAD_DEPT' });
  const cur = (db.prepare('SELECT level FROM departments WHERE account_id = ? AND dept_key = ?').get(accountId, deptKey) as { level: number } | undefined)?.level ?? 1;
  if (cur >= spec.maxLv) return res.status(409).json({ error: 'MAX_LEVEL' });
  const cost = spec.costs[cur - 1];
  const acc = accountRow(accountId);
  if (acc.capital < cost) return res.status(402).json({ error: 'INSUFFICIENT_CAPITAL', shortfall: cost - acc.capital });
  db.prepare('UPDATE accounts SET capital = capital - ? WHERE id = ?').run(cost, accountId);
  // 계정 생성 후 추가된 부서(마진 데스크 등)는 행이 없을 수 있다 — upsert
  const upd = db.prepare('UPDATE departments SET level = ? WHERE account_id = ? AND dept_key = ?').run(cur + 1, accountId, deptKey);
  if (upd.changes === 0) db.prepare('INSERT INTO departments (account_id, dept_key, level) VALUES (?, ?, ?)').run(accountId, deptKey, cur + 1);
  res.json({ ok: true, deptKey, level: cur + 1, capital: acc.capital - cost });
});

// ─── FR-10 도감 ───
router.get('/codex', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const { sector, rarity, sort } = req.query as { sector?: string; rarity?: string; sort?: string };
  let rows = db.prepare(
    `SELECT ce.first_cleared_at, ce.best_accuracy, ce.best_grade,
            cs.ticker, cs.company_name, cs.trade_date, cs.sector, cs.day_change_pct, cs.rarity
     FROM codex_entries ce JOIN chart_sets cs ON cs.id = ce.chart_set_id
     WHERE ce.account_id = ?`,
  ).all(accountId) as Record<string, unknown>[];
  if (sector) rows = rows.filter((r) => r.sector === sector);
  if (rarity) rows = rows.filter((r) => r.rarity === rarity);
  const rarityRank = { legendary: 4, epic: 3, rare: 2, common: 1 } as Record<string, number>;
  if (sort === 'rarity') rows.sort((a, b) => (rarityRank[b.rarity as string] ?? 0) - (rarityRank[a.rarity as string] ?? 0));
  else rows.sort((a, b) => String(b.trade_date).localeCompare(String(a.trade_date)));
  res.json({ entries: rows });
});

// ─── §12 텔레메트리 (최소) ───
router.post('/telemetry', (req, res) => {
  const accountId = (req as unknown as AuthedRequest).accountId;
  const { events } = req.body as { events: { event: string; props?: unknown }[] };
  if (Array.isArray(events)) {
    const ins = db.prepare('INSERT INTO telemetry (account_id, event, props) VALUES (?, ?, ?)');
    for (const e of events.slice(0, 50)) ins.run(accountId, String(e.event).slice(0, 64), JSON.stringify(e.props ?? {}));
  }
  res.json({ ok: true });
});
